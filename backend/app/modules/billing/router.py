"""Billing API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_platform_admin
from app.database import get_db
from app.models.tenant import User
from app.modules.billing.schemas import (
    CouponCreate,
    CouponResponse,
    CouponUpdate,
    InvoiceResponse,
    ServicePlanCreate,
    ServicePlanResponse,
    ServicePlanUpdate,
    SubscriptionCreate,
    SubscriptionResponse,
    TenantUsageDashboard,
    UsageSummaryResponse,
)
from app.modules.billing.service import billing_service
from app.modules.billing.coupon_service import coupon_service

router = APIRouter()


# --- Admin: Plan Management ---

@router.get("/plans", response_model=list[ServicePlanResponse])
async def list_plans(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    plans = await billing_service.list_plans(db, active_only=active_only)
    return plans


@router.post("/plans", response_model=ServicePlanResponse, status_code=201)
async def create_plan(
    body: ServicePlanCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    plan = await billing_service.create_plan(
        db, name=body.name, description=body.description,
        is_default=body.is_default, is_trial=body.is_trial,
        billing_cycle=body.billing_cycle, base_price=body.base_price,
        pricing_rules=[r.model_dump() for r in body.pricing_rules],
    )
    return plan


# --- Admin: Coupon Management ---

@router.get("/coupons", response_model=dict)
async def list_coupons(
    active_only: bool = False,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    coupons, total = await coupon_service.list(db, active_only=active_only, limit=limit, offset=offset)
    return {
        "items": [CouponResponse.model_validate(c) for c in coupons],
        "total": total,
    }


@router.post("/coupons", response_model=CouponResponse, status_code=201)
async def create_coupon(
    body: CouponCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    coupon = await coupon_service.create(
        db, code=body.code, discount_type=body.discount_type, discount_value=body.discount_value,
        description=body.description, valid_from=body.valid_from, valid_until=body.valid_until,
        max_uses=body.max_uses, plan_ids=body.plan_ids,
    )
    return CouponResponse.model_validate(coupon)


@router.get("/coupons/{coupon_id}", response_model=CouponResponse)
async def get_coupon(
    coupon_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    coupon = await coupon_service.get(db, coupon_id)
    return CouponResponse.model_validate(coupon)


@router.patch("/coupons/{coupon_id}", response_model=CouponResponse)
async def update_coupon(
    coupon_id: UUID,
    body: CouponUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    coupon = await coupon_service.update(db, coupon_id, **body.model_dump(exclude_unset=True))
    return CouponResponse.model_validate(coupon)


@router.delete("/coupons/{coupon_id}", status_code=204)
async def delete_coupon(
    coupon_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    await coupon_service.delete(db, coupon_id)


@router.patch("/plans/{plan_id}", response_model=ServicePlanResponse)
async def update_plan(
    plan_id: UUID,
    body: ServicePlanUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    plan = await billing_service.update_plan(
        db, plan_id, **body.model_dump(exclude_unset=True),
    )
    return plan


# --- Admin: Subscription Management ---

@router.get("/subscriptions")
async def list_subscriptions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """List all tenant subscriptions. Platform admin only."""
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload
    from app.models.billing import TenantSubscription
    result = await db.execute(
        select(TenantSubscription)
        .options(joinedload(TenantSubscription.plan), joinedload(TenantSubscription.tenant))
        .order_by(TenantSubscription.created_at.desc())
    )
    subs = result.unique().scalars().all()
    items = []
    for s in subs:
        items.append({
            "id": str(s.id),
            "tenant_name": s.tenant.name if s.tenant else "Unknown",
            "plan_name": s.plan.name if s.plan else "Unknown",
            "status": s.status.value if hasattr(s.status, "value") else str(s.status),
            "monthly_amount": float(s.plan.base_price) if s.plan else 0,
            "next_invoice_date": s.current_period_end.isoformat() if s.current_period_end else None,
        })
    return items


@router.post("/subscriptions", response_model=SubscriptionResponse, status_code=201)
async def create_subscription(
    body: SubscriptionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    sub = await billing_service.create_subscription(
        db, tenant_id=body.tenant_id, plan_id=body.plan_id,
        billing_cycle=body.billing_cycle,
        grace_period_hours=body.grace_period_hours,
        custom_overrides=body.custom_overrides,
        coupon_code=body.coupon_code,
    )
    return sub


@router.get("/subscriptions/{tenant_id}", response_model=SubscriptionResponse | None)
async def get_subscription(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    return await billing_service.get_tenant_subscription(db, tenant_id)


# --- Tenant: Usage Dashboard ---

@router.get("/usage/me")
async def my_usage(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Current tenant's usage dashboard for their billing period."""
    if not user.tenant_id:
        return {"services": [], "estimated_cost": 0.0}
    return await billing_service.get_tenant_usage_dashboard(db, user.tenant_id)


# --- Tenant: Invoices ---

@router.get("/invoices")
async def my_invoices(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Current tenant's invoices."""
    if not user.tenant_id:
        return []
    from sqlalchemy import select
    from app.models.billing import Invoice
    result = await db.execute(
        select(Invoice).where(Invoice.tenant_id == user.tenant_id).order_by(Invoice.created_at.desc())
    )
    return list(result.scalars().all())


# --- Admin: Invoices ---

@router.post("/invoices/generate")
async def generate_invoice(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    sub = await billing_service.get_tenant_subscription(db, tenant_id)
    if not sub:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("No active subscription for tenant")
    invoice = await billing_service.generate_invoice(
        db, tenant_id, sub.current_period_start, sub.current_period_end,
    )
    return InvoiceResponse.model_validate(invoice)


@router.get("/invoices/{tenant_id}", response_model=list[InvoiceResponse])
async def list_invoices(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    from sqlalchemy import select
    from app.models.billing import Invoice
    result = await db.execute(
        select(Invoice).where(Invoice.tenant_id == tenant_id).order_by(Invoice.created_at.desc())
    )
    return list(result.scalars().all())
