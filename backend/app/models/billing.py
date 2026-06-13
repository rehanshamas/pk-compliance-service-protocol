"""Billing models: service plans, subscriptions, pricing, invoices."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger, Boolean, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ServiceType(str, enum.Enum):
    """Billable service categories."""
    kyc = "kyc"
    screening = "screening"
    analytics_l1 = "analytics_l1"
    analytics_l3 = "analytics_l3"
    reports = "reports"
    form_generation = "form_generation"


class BillingCycle(str, enum.Enum):
    monthly = "monthly"
    quarterly = "quarterly"
    annual = "annual"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    issued = "issued"
    paid = "paid"
    overdue = "overdue"
    cancelled = "cancelled"


class ServicePlan(Base):
    """Defines a billing plan (e.g., Trial, Starter, Professional, Enterprise)."""
    __tablename__ = "service_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_trial: Mapped[bool] = mapped_column(Boolean, default=False)
    billing_cycle: Mapped[BillingCycle] = mapped_column(
        Enum(BillingCycle), nullable=False, default=BillingCycle.monthly
    )
    base_price: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)  # Monthly base fee
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    pricing_rules: Mapped[list["PricingRule"]] = relationship("PricingRule", back_populates="plan", lazy="selectin")


class PricingRule(Base):
    """Per-service pricing within a plan."""
    __tablename__ = "pricing_rules"
    __table_args__ = (
        UniqueConstraint("plan_id", "service_type", name="uq_pricing_rule_plan_service"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("service_plans.id", ondelete="CASCADE"), nullable=False)
    service_type: Mapped[ServiceType] = mapped_column(Enum(ServiceType), nullable=False)
    included_in_plan: Mapped[bool] = mapped_column(Boolean, default=False)  # True = service available in this plan
    price_per_unit: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)  # Cost per call/check/query
    quota_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0 = unlimited
    overage_price_per_unit: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)  # Price when over quota
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plan: Mapped["ServicePlan"] = relationship("ServicePlan", back_populates="pricing_rules")


class TenantSubscription(Base):
    """A tenant's active subscription to a plan with service-level overrides."""
    __tablename__ = "tenant_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("service_plans.id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    billing_cycle: Mapped[BillingCycle] = mapped_column(Enum(BillingCycle), nullable=False, default=BillingCycle.monthly)
    current_period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    current_period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    grace_period_hours: Mapped[int] = mapped_column(Integer, default=48)  # 48h = 2 days grace
    custom_overrides: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # Per-tenant pricing overrides
    coupon_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("discount_coupons.id", ondelete="SET NULL"), nullable=True
    )
    discount_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    plan: Mapped["ServicePlan"] = relationship("ServicePlan", lazy="selectin")


class ServiceUsageSummary(Base):
    """Aggregated usage per tenant per service per billing period."""
    __tablename__ = "service_usage_summaries"
    __table_args__ = (
        UniqueConstraint("tenant_id", "service_type", "period_start", name="uq_usage_summary_tenant_service_period"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    service_type: Mapped[ServiceType] = mapped_column(Enum(ServiceType), nullable=False, index=True)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    total_usage: Mapped[int] = mapped_column(Integer, default=0)
    quota_limit: Mapped[int] = mapped_column(Integer, default=0)  # Snapshot of limit at period start
    overage_count: Mapped[int] = mapped_column(Integer, default=0)  # Usage beyond quota
    is_overage_alerted: Mapped[bool] = mapped_column(Boolean, default=False)  # Was admin notified?
    grace_period_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DiscountCoupon(Base):
    """Discount coupon for subscriptions. Admin-created, applied at subscription creation."""
    __tablename__ = "discount_coupons"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    discount_type: Mapped[str] = mapped_column(String(20), nullable=False, default="percent")  # percent | fixed
    discount_value: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None = unlimited
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    plan_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # None = all plans; [] = restrict to listed
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CouponRedemption(Base):
    """Tracks coupon usage per tenant."""
    __tablename__ = "coupon_redemptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    coupon_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("discount_coupons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenant_subscriptions.id", ondelete="SET NULL"), nullable=True
    )
    discount_applied: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Invoice(Base):
    """Generated invoice for a billing period."""
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), nullable=False, default=InvoiceStatus.draft)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    subtotal: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    discount_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    coupon_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="PKR")
    line_items: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)  # Detailed breakdown
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
