"""MonitoringRule model for transaction monitoring. Phase 6.6."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MonitoringRuleType(str, enum.Enum):
    threshold = "threshold"
    velocity = "velocity"
    pattern = "pattern"
    counterparty = "counterparty"
    typology = "typology"


class MonitoringRuleSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class MonitoringRule(Base):
    """Transaction monitoring rule. tenant_id=null => platform default."""

    __tablename__ = "monitoring_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    rule_type: Mapped[MonitoringRuleType] = mapped_column(
        Enum(MonitoringRuleType), nullable=False, index=True
    )
    conditions: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    severity: Mapped[MonitoringRuleSeverity] = mapped_column(
        Enum(MonitoringRuleSeverity), nullable=False, index=True
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
