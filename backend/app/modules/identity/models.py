"""Identity/KYC models: Customer (4.1), IdentityDocument (4.3)."""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RiskTier(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    prohibited = "prohibited"


class KycStatus(str, enum.Enum):
    initiated = "initiated"
    documents_uploaded = "documents_uploaded"
    identity_verified = "identity_verified"
    liveness_checked = "liveness_checked"
    risk_scored = "risk_scored"
    approved = "approved"
    rejected = "rejected"
    edd_required = "edd_required"
    edd_in_progress = "edd_in_progress"
    frozen = "frozen"


class DocumentType(str, enum.Enum):
    cnic = "cnic"
    passport = "passport"
    driving_license = "driving_license"
    selfie = "selfie"
    # EDD enhanced docs (Phase 4.10)
    proof_of_address = "proof_of_address"
    bank_statement = "bank_statement"


class EddApprovalStatus(str, enum.Enum):
    """EDD case approval state. Phase 4.10."""
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class VerificationType(str, enum.Enum):
    nadra = "nadra"
    document_ocr = "document_ocr"
    face_match = "face_match"
    liveness = "liveness"


class VerificationStatus(str, enum.Enum):
    pass_ = "pass"
    fail = "fail"
    inconclusive = "inconclusive"


class Customer(Base):
    """Tenant-scoped KYC customer. Phase 4.1."""

    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    external_ref: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    dob: Mapped[date | None] = mapped_column(Date, nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cnic_number: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    business_purpose: Mapped[str | None] = mapped_column(String(512), nullable=True)  # Reg. 9.2(c): nature and purpose of business relationship
    expected_activity: Mapped[str | None] = mapped_column(String(512), nullable=True)  # Expected transaction profile
    risk_tier: Mapped[RiskTier] = mapped_column(
        Enum(RiskTier), nullable=False, default=RiskTier.medium
    )
    kyc_status: Mapped[KycStatus] = mapped_column(
        Enum(KycStatus), nullable=False, default=KycStatus.initiated
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    documents: Mapped[list["IdentityDocument"]] = relationship(
        "IdentityDocument",
        back_populates="customer",
        cascade="all, delete-orphan",
    )
    edd_case: Mapped["EddCase | None"] = relationship(
        "EddCase",
        back_populates="customer",
        uselist=False,
        cascade="all, delete-orphan",
    )


class IdentityDocument(Base):
    """Uploaded KYC document (Phase 4.3). Stored in S3, metadata here."""

    __tablename__ = "identity_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    document_type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType, name="identity_documenttype"), nullable=False
    )
    file_key: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    ocr_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    customer: Mapped["Customer"] = relationship("Customer", back_populates="documents")


# EDD-enhanced document types (Phase 4.10)
EDD_DOCUMENT_TYPES = {DocumentType.proof_of_address, DocumentType.bank_statement}


class EddCase(Base):
    """Enhanced Due Diligence case. Phase 4.10. Links to Customer in edd_required/edd_in_progress."""

    __tablename__ = "edd_cases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    source_of_funds: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    source_of_funds_verified: Mapped[bool] = mapped_column(default=False, nullable=False)
    approval_status: Mapped[EddApprovalStatus] = mapped_column(
        Enum(EddApprovalStatus, name="edd_approval_status_enum"), nullable=False, default=EddApprovalStatus.pending
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approval_notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    customer: Mapped["Customer"] = relationship("Customer", back_populates="edd_case")


class ShuftiPendingVerification(Base):
    """Pending Shufti e-IDV verification. Maps reference -> customer for callback. Phase 7."""

    __tablename__ = "shufti_pending_verifications"

    reference: Mapped[str] = mapped_column(String(128), primary_key=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class VerificationResult(Base):
    """KYC verification result (OCR, face match, liveness, NADRA). Phase 4.4–4.6."""

    __tablename__ = "verification_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    verification_type: Mapped[VerificationType] = mapped_column(
        Enum(VerificationType, name="verification_type_enum"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus, name="verification_status_enum"), nullable=False
    )
    raw_response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class FreezeRecord(Base):
    """Asset freeze record per PVARA NOC Regulation 12.2. Tracks TFS/sanctions freezes."""

    __tablename__ = "freeze_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    screening_result_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    alert_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    freeze_type: Mapped[str] = mapped_column(String(50), nullable=False)  # tfs_sanctions | nacta | un | court_order
    matched_list: Mapped[str | None] = mapped_column(String(50), nullable=True)  # UN, NACTA, OFAC, EU
    matched_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    match_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="frozen")  # frozen | reported_to_fmu | unfrozen
    frozen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reported_to_fmu_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    unfrozen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    unfreeze_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)  # fmu_order | court_order | false_positive_confirmed

    frozen_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    customer: Mapped["Customer"] = relationship("Customer", foreign_keys=[customer_id])


class BeneficialOwner(Base):
    """Beneficial owner of a customer entity. Reg. 12.1 requires screening of all beneficial owners."""
    __tablename__ = "beneficial_owners"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    cnic_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(3), nullable=True)
    ownership_percentage: Mapped[float | None] = mapped_column(nullable=True)
    relationship: Mapped[str | None] = mapped_column(String(128), nullable=True)  # "director", "shareholder", "controller"
    screening_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")  # pending | clear | potential_match | confirmed_match
    last_screened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
