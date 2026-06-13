"""Billing module Pydantic schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# --- Service Plans ---

class PricingRuleCreate(BaseModel):
    service_type: str
    included_in_plan: bool = False
    price_per_unit: float = 0.0
    quota_limit: int = 0
    overage_price_per_unit: float = 0.0


class PricingRuleResponse(PricingRuleCreate):
    id: UUID
    plan_id: UUID

    class Config:
        from_attributes = True


class ServicePlanCreate(BaseModel):
    name: str = Field(max_length=100)
    description: str | None = None
    is_default: bool = False
    is_trial: bool = False
    billing_cycle: str = "monthly"
    base_price: float = 0.0
    pricing_rules: list[PricingRuleCreate] = []


class ServicePlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_default: bool | None = None
    billing_cycle: str | None = None
    base_price: float | None = None
    is_active: bool | None = None


class ServicePlanResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    is_default: bool
    is_trial: bool
    billing_cycle: str
    base_price: float
    is_active: bool
    pricing_rules: list[PricingRuleResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# --- Coupons ---

class CouponCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    description: str | None = None
    discount_type: str = Field(..., pattern="^(percent|fixed)$")
    discount_value: float = Field(..., gt=0)  # percent: 0-100, fixed: any positive
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    max_uses: int | None = None
    plan_ids: list[UUID] | None = None


class CouponUpdate(BaseModel):
    description: str | None = None
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    max_uses: int | None = None
    plan_ids: list[UUID] | None = None
    is_active: bool | None = None


class CouponResponse(BaseModel):
    id: UUID
    code: str
    description: str | None
    discount_type: str
    discount_value: float
    valid_from: datetime | None
    valid_until: datetime | None
    max_uses: int | None
    used_count: int
    plan_ids: list[str] | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Subscriptions ---

class SubscriptionCreate(BaseModel):
    tenant_id: UUID
    plan_id: UUID
    billing_cycle: str = "monthly"
    grace_period_hours: int = 48
    custom_overrides: dict | None = None
    coupon_code: str | None = None


class SubscriptionResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    plan_id: UUID
    is_active: bool
    billing_cycle: str
    current_period_start: datetime
    current_period_end: datetime
    trial_ends_at: datetime | None
    grace_period_hours: int
    plan: ServicePlanResponse | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Usage ---

class UsageSummaryResponse(BaseModel):
    service_type: str
    total_usage: int
    quota_limit: int
    overage_count: int
    is_overage_alerted: bool
    period_start: datetime
    period_end: datetime

    class Config:
        from_attributes = True


class TenantUsageDashboard(BaseModel):
    tenant_id: UUID
    tenant_name: str
    plan_name: str
    billing_cycle: str
    period_start: datetime
    period_end: datetime
    services: list[UsageSummaryResponse]
    estimated_cost: float


# --- Invoices ---

class InvoiceResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    invoice_number: str
    status: str
    period_start: datetime
    period_end: datetime
    subtotal: float
    tax_amount: float
    total: float
    currency: str
    line_items: list[dict]
    issued_at: datetime | None
    paid_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Quota Check ---

class QuotaCheckResult(BaseModel):
    allowed: bool
    service_type: str
    current_usage: int
    quota_limit: int
    is_in_grace_period: bool = False
    grace_period_expires_at: datetime | None = None
    message: str = ""
