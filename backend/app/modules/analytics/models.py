"""Wallet and risk score models for blockchain analytics. Phase 6.1."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Chain(str, enum.Enum):
    ethereum = "ethereum"
    bitcoin = "bitcoin"
    bsc = "bsc"
    polygon = "polygon"
    tron = "tron"


class RiskCategory(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    severe = "severe"


class ConfidenceLevel(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"


class ResolutionLayer(str, enum.Enum):
    layer_1 = "layer_1"
    layer_2 = "layer_2"
    layer_3 = "layer_3"


class Wallet(Base):
    """Tenant-scoped wallet for risk scoring."""

    __tablename__ = "wallets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    address: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    chain: Mapped[Chain] = mapped_column(Enum(Chain), nullable=False, default=Chain.ethereum, index=True)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_scored_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    monitoring_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    external_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)

    risk_scores: Mapped[list["WalletRiskScore"]] = relationship(
        "WalletRiskScore",
        back_populates="wallet",
    )


class WalletRiskScore(Base):
    """Risk score snapshot for a wallet. Append-only history."""

    __tablename__ = "wallet_risk_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False)
    risk_category: Mapped[RiskCategory] = mapped_column(
        Enum(RiskCategory), nullable=False, index=True
    )
    exposure_breakdown: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    flagged_indicators: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    confidence_level: Mapped[ConfidenceLevel] = mapped_column(
        Enum(ConfidenceLevel), nullable=False, index=True
    )
    resolution_layer: Mapped[ResolutionLayer] = mapped_column(
        Enum(ResolutionLayer), nullable=False, index=True
    )
    chains_analyzed: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    cached: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    cache_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    wallet: Mapped["Wallet"] = relationship("Wallet", back_populates="risk_scores")
