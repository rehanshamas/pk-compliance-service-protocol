"""Incident reporting model. PVARA Sandbox Undertaking clauses 8-9.

- Material incidents must be notified within 1 hour
- Detailed report submitted within 48 hours
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, Float, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class IncidentSeverity(str, enum.Enum):
    critical = "critical"  # System-wide, data breach, regulatory breach
    high = "high"          # Significant impact, service disruption
    medium = "medium"      # Limited impact, no data loss
    low = "low"            # Minor, informational


class IncidentCategory(str, enum.Enum):
    data_breach = "data_breach"
    system_outage = "system_outage"
    compliance_breach = "compliance_breach"
    fraud_detected = "fraud_detected"
    cybersecurity = "cybersecurity"
    operational_failure = "operational_failure"
    sanctions_violation = "sanctions_violation"
    unauthorized_access = "unauthorized_access"
    other = "other"


class IncidentStatus(str, enum.Enum):
    detected = "detected"                    # Just identified
    authority_notified = "authority_notified" # 1-hour notification sent
    investigating = "investigating"          # Under investigation
    report_submitted = "report_submitted"    # 48-hour detailed report done
    resolved = "resolved"                    # Incident resolved
    closed = "closed"                        # Closed after review


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    # Core incident info
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    severity: Mapped[IncidentSeverity] = mapped_column(Enum(IncidentSeverity), nullable=False, index=True)
    category: Mapped[IncidentCategory] = mapped_column(Enum(IncidentCategory), nullable=False, index=True)
    status: Mapped[IncidentStatus] = mapped_column(Enum(IncidentStatus), nullable=False, default=IncidentStatus.detected, index=True)

    # Initial notification (1 hour requirement)
    description: Mapped[str] = mapped_column(Text, nullable=False)  # Brief description for initial notification
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)  # When incident was detected
    notification_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)  # detected_at + 1 hour
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # When authority was actually notified
    notification_overdue: Mapped[bool] = mapped_column(nullable=False, default=False)  # Flag if 1hr deadline missed

    # Detailed report (48 hour requirement)
    report_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)  # detected_at + 48 hours
    detailed_report: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)  # Structured report
    report_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    report_overdue: Mapped[bool] = mapped_column(nullable=False, default=False)

    # Impact and resolution
    affected_customers_count: Mapped[int | None] = mapped_column(nullable=True)
    affected_systems: Mapped[str | None] = mapped_column(Text, nullable=True)
    containment_steps: Mapped[str | None] = mapped_column(Text, nullable=True)
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    remediation_steps: Mapped[str | None] = mapped_column(Text, nullable=True)
    prevention_measures: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Metadata
    reported_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
