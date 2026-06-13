"""Compliance models: Case, CaseNote, CaseAlertLink, CaseCustomerLink, Isar, StrReport."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CaseStatus(str, enum.Enum):
    open = "open"
    investigating = "investigating"
    escalated = "escalated"
    closed_no_action = "closed_no_action"
    closed_str_filed = "closed_str_filed"


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_alert_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[CaseStatus] = mapped_column(
        Enum(CaseStatus), nullable=False, default=CaseStatus.open, index=True
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    notes: Mapped[list["CaseNote"]] = relationship("CaseNote", back_populates="case", cascade="all, delete-orphan")
    alert_links: Mapped[list["CaseAlertLink"]] = relationship(
        "CaseAlertLink", back_populates="case", cascade="all, delete-orphan"
    )
    customer_links: Mapped[list["CaseCustomerLink"]] = relationship(
        "CaseCustomerLink", back_populates="case", cascade="all, delete-orphan"
    )


class CaseNote(Base):
    __tablename__ = "case_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    case: Mapped["Case"] = relationship("Case", back_populates="notes")


class CaseAlertLink(Base):
    __tablename__ = "case_alert_links"

    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), primary_key=True
    )
    alert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("alerts.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    case: Mapped["Case"] = relationship("Case", back_populates="alert_links")


class CaseCustomerLink(Base):
    __tablename__ = "case_customer_links"

    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), primary_key=True
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    case: Mapped["Case"] = relationship("Case", back_populates="customer_links")


class IsarStatus(str, enum.Enum):
    draft = "draft"
    submitted_for_review = "submitted_for_review"
    approved = "approved"
    rejected = "rejected"
    filed_as_str = "filed_as_str"


class Isar(Base):
    """Internal Suspicious Activity Report (Form A7).

    Five sections per PVARA:
      1. Reporter Details (reporter_details JSONB)
      2. Customer Details (customer_details JSONB)
      3. Transaction Details (transaction_details JSONB)
      4. Suspicion Narrative (narrative Text + suspicion_type)
      5. MLRO Determination (mlro_determination JSONB)
    """

    __tablename__ = "isars"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    case_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=True, index=True
    )
    subject_customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    suspicion_type: Mapped[str] = mapped_column(String(128), nullable=False)
    narrative: Mapped[str] = mapped_column(Text, nullable=False)
    supporting_evidence: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)

    # Form A7 structured sections (WS-6)
    reporter_details: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    customer_details: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    transaction_details: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    mlro_determination: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)

    status: Mapped[IsarStatus] = mapped_column(
        Enum(IsarStatus), nullable=False, default=IsarStatus.draft, index=True
    )
    submitted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    filed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_rationale: Mapped[str | None] = mapped_column(Text, nullable=True)


class StrReportType(str, enum.Enum):
    str_ = "str"
    ctr = "ctr"


class StrFilingStatus(str, enum.Enum):
    generated = "generated"
    exported = "exported"
    filed = "filed"


class StrReport(Base):
    """Suspicious Transaction Report for goAML. Phase 5.3. Generated from filed ISAR."""

    __tablename__ = "str_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    isar_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("isars.id", ondelete="CASCADE"), nullable=False, index=True
    )
    report_type: Mapped[StrReportType] = mapped_column(
        Enum(StrReportType), nullable=False, default=StrReportType.str_, index=True
    )
    goaml_xml: Mapped[str] = mapped_column(Text, nullable=False)
    goaml_schema_version: Mapped[str] = mapped_column(String(32), nullable=False, default="1.0")
    filing_status: Mapped[StrFilingStatus] = mapped_column(
        Enum(StrFilingStatus), nullable=False, default=StrFilingStatus.generated, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Record(Base):
    """Retention-tracked record in S3/MinIO. Phase 5.6. Deletion blocked within 7-year retention."""

    __tablename__ = "records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    record_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    record_ref_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    file_key: Mapped[str] = mapped_column(String(512), nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)  # SHA-256 hash for tamper evidence (Reg. 13.2)
    retention_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
