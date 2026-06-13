"""Billing service: plans, subscriptions, usage metering, quota enforcement."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import (
    BillingCycle,
    Invoice,
    InvoiceStatus,
    PricingRule,
    ServicePlan,
    ServiceType,
    ServiceUsageSummary,
    TenantSubscription,
)
from app.models.usage_event import UsageEvent
from app.core.exceptions import NotFoundError, ValidationError
from app.modules.billing.coupon_service import coupon_service


# Map usage event types to ServiceType
EVENT_TYPE_TO_SERVICE: dict[str, ServiceType] = {
    "kyc.verification": ServiceType.kyc,
    "identity.verify": ServiceType.kyc,
    "screening.check": ServiceType.screening,
    "screening.batch": ServiceType.screening,
    "screening.ongoing_monitoring": ServiceType.screening,
    "analytics.query": ServiceType.analytics_l1,
    "commercial.api": ServiceType.analytics_l3,
    "analytics.commercial": ServiceType.analytics_l3,
    "compliance.isar": ServiceType.reports,
    "compliance.str": ServiceType.reports,
    "compliance.ctr": ServiceType.reports,
    "form.a5": ServiceType.form_generation,
    "form.a6": ServiceType.form_generation,
}


class BillingService:
    """Manages service plans, tenant subscriptions, and quota enforcement."""

    # --- Plan Management (Admin) ---

    async def list_plans(self, db: AsyncSession, active_only: bool = True) -> list[ServicePlan]:
        query = select(ServicePlan)
        if active_only:
            query = query.where(ServicePlan.is_active.is_(True))
        query = query.order_by(ServicePlan.base_price)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_plan(self, db: AsyncSession, plan_id: UUID) -> ServicePlan:
        result = await db.execute(select(ServicePlan).where(ServicePlan.id == plan_id))
        plan = result.scalar_one_or_none()
        if not plan:
            raise NotFoundError("Service plan not found")
        return plan

    async def create_plan(
        self, db: AsyncSession, name: str, description: str | None,
        is_default: bool, is_trial: bool, billing_cycle: str,
        base_price: float, pricing_rules: list[dict],
    ) -> ServicePlan:
        plan = ServicePlan(
            name=name,
            description=description,
            is_default=is_default,
            is_trial=is_trial,
            billing_cycle=BillingCycle(billing_cycle),
            base_price=base_price,
        )
        db.add(plan)
        await db.flush()

        for rule_data in pricing_rules:
            rule = PricingRule(
                plan_id=plan.id,
                service_type=ServiceType(rule_data["service_type"]),
                included_in_plan=rule_data.get("included_in_plan", False),
                price_per_unit=rule_data.get("price_per_unit", 0.0),
                quota_limit=rule_data.get("quota_limit", 0),
                overage_price_per_unit=rule_data.get("overage_price_per_unit", 0.0),
            )
            db.add(rule)

        return plan

    async def update_plan(self, db: AsyncSession, plan_id: UUID, **kwargs) -> ServicePlan:
        plan = await self.get_plan(db, plan_id)
        for key, value in kwargs.items():
            if value is not None and hasattr(plan, key):
                setattr(plan, key, value)
        return plan

    # --- Subscription Management ---

    async def get_tenant_subscription(
        self, db: AsyncSession, tenant_id: UUID,
    ) -> TenantSubscription | None:
        result = await db.execute(
            select(TenantSubscription).where(
                TenantSubscription.tenant_id == tenant_id,
                TenantSubscription.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def create_subscription(
        self, db: AsyncSession, tenant_id: UUID, plan_id: UUID,
        billing_cycle: str = "monthly", grace_period_hours: int = 48,
        custom_overrides: dict | None = None,
        coupon_code: str | None = None,
    ) -> TenantSubscription:
        # Deactivate existing subscription
        existing = await self.get_tenant_subscription(db, tenant_id)
        if existing:
            existing.is_active = False

        plan = await self.get_plan(db, plan_id)
        now = datetime.now(timezone.utc)
        cycle = BillingCycle(billing_cycle)

        if cycle == BillingCycle.monthly:
            period_end = now + timedelta(days=30)
        elif cycle == BillingCycle.quarterly:
            period_end = now + timedelta(days=90)
        else:
            period_end = now + timedelta(days=365)

        trial_ends = now + timedelta(days=14) if plan.is_trial else None

        coupon_id = None
        discount_amount = 0.0
        coupon_code_str = None

        if coupon_code and coupon_code.strip():
            coupon, discount_amount = await coupon_service.validate(db, coupon_code.strip(), plan_id, tenant_id)
            coupon_id = coupon.id
            coupon_code_str = coupon.code

        sub = TenantSubscription(
            tenant_id=tenant_id,
            plan_id=plan_id,
            billing_cycle=cycle,
            current_period_start=now,
            current_period_end=period_end,
            trial_ends_at=trial_ends,
            grace_period_hours=grace_period_hours,
            custom_overrides=custom_overrides,
            coupon_id=coupon_id,
            discount_amount=discount_amount,
        )
        db.add(sub)
        await db.flush()

        if coupon_id and discount_amount > 0:
            await coupon_service.record_redemption(
                db, coupon_id, tenant_id, sub.id, discount_amount,
            )

        return sub

    # --- Quota Check (called before each billable operation) ---

    async def check_quota(
        self, db: AsyncSession, tenant_id: UUID, service_type: ServiceType,
    ) -> dict:
        """Check if tenant can perform a billable operation.

        Returns dict with: allowed (bool), current_usage, quota_limit,
        is_in_grace_period, message.

        Soft enforcement: always returns allowed=True but flags overages.
        """
        sub = await self.get_tenant_subscription(db, tenant_id)
        if not sub:
            # No subscription — allow but log (they'll get a default plan)
            return {
                "allowed": True,
                "service_type": service_type.value,
                "current_usage": 0,
                "quota_limit": 0,
                "is_in_grace_period": False,
                "grace_period_expires_at": None,
                "message": "No active subscription — usage will be tracked",
            }

        # Get quota for this service from plan pricing rules
        result = await db.execute(
            select(PricingRule).where(
                PricingRule.plan_id == sub.plan_id,
                PricingRule.service_type == service_type,
            )
        )
        pricing_rule = result.scalar_one_or_none()

        if pricing_rule and not pricing_rule.included_in_plan:
            return {
                "allowed": True,  # Soft limit
                "service_type": service_type.value,
                "current_usage": 0,
                "quota_limit": 0,
                "is_in_grace_period": False,
                "grace_period_expires_at": None,
                "message": f"Service {service_type.value} not included in current plan — usage will be billed as overage",
            }

        quota_limit = pricing_rule.quota_limit if pricing_rule else 0

        # Get current period usage
        summary = await self._get_or_create_usage_summary(
            db, tenant_id, service_type, sub.current_period_start, sub.current_period_end, quota_limit,
        )

        now = datetime.now(timezone.utc)
        is_over_quota = quota_limit > 0 and summary.total_usage >= quota_limit
        is_in_grace = False
        grace_expires = None

        if is_over_quota:
            if not summary.is_overage_alerted:
                summary.is_overage_alerted = True
                summary.grace_period_expires_at = now + timedelta(hours=sub.grace_period_hours)

            grace_expires = summary.grace_period_expires_at
            is_in_grace = grace_expires is not None and now < grace_expires

        return {
            "allowed": True,  # Always allow (soft limit)
            "service_type": service_type.value,
            "current_usage": summary.total_usage,
            "quota_limit": quota_limit,
            "is_in_grace_period": is_in_grace,
            "grace_period_expires_at": grace_expires,
            "message": "Over quota — grace period active" if is_in_grace else ("Over quota — grace period expired" if is_over_quota else "OK"),
        }

    async def record_usage(
        self, db: AsyncSession, tenant_id: UUID, event_type: str, quantity: float = 1.0,
    ) -> None:
        """Record a billable usage event and update the usage summary."""
        service_type = EVENT_TYPE_TO_SERVICE.get(event_type)
        if not service_type:
            return  # Not a billable event

        sub = await self.get_tenant_subscription(db, tenant_id)
        if not sub:
            return

        # Update usage summary
        result = await db.execute(
            select(PricingRule).where(
                PricingRule.plan_id == sub.plan_id,
                PricingRule.service_type == service_type,
            )
        )
        pricing_rule = result.scalar_one_or_none()
        quota_limit = pricing_rule.quota_limit if pricing_rule else 0

        summary = await self._get_or_create_usage_summary(
            db, tenant_id, service_type, sub.current_period_start, sub.current_period_end, quota_limit,
        )
        summary.total_usage += int(quantity)
        if quota_limit > 0 and summary.total_usage > quota_limit:
            summary.overage_count = summary.total_usage - quota_limit

    # --- Usage Dashboard ---

    async def get_tenant_usage_dashboard(
        self, db: AsyncSession, tenant_id: UUID,
    ) -> dict:
        """Get usage summary for tenant's current billing period."""
        sub = await self.get_tenant_subscription(db, tenant_id)
        if not sub:
            return {"services": [], "estimated_cost": 0.0}

        result = await db.execute(
            select(ServiceUsageSummary).where(
                ServiceUsageSummary.tenant_id == tenant_id,
                ServiceUsageSummary.period_start == sub.current_period_start,
            )
        )
        summaries = list(result.scalars().all())

        # Calculate estimated cost
        total_cost = sub.plan.base_price if sub.plan else 0.0
        for s in summaries:
            pr_result = await db.execute(
                select(PricingRule).where(
                    PricingRule.plan_id == sub.plan_id,
                    PricingRule.service_type == s.service_type,
                )
            )
            pr = pr_result.scalar_one_or_none()
            if pr:
                within_quota = min(s.total_usage, pr.quota_limit) if pr.quota_limit > 0 else s.total_usage
                overage = max(0, s.total_usage - pr.quota_limit) if pr.quota_limit > 0 else 0
                total_cost += within_quota * pr.price_per_unit
                total_cost += overage * pr.overage_price_per_unit

        return {
            "plan_name": sub.plan.name if sub.plan else "None",
            "billing_cycle": sub.billing_cycle.value,
            "period_start": sub.current_period_start,
            "period_end": sub.current_period_end,
            "services": summaries,
            "estimated_cost": round(total_cost, 2),
        }

    # --- Invoice Generation ---

    async def generate_invoice(
        self, db: AsyncSession, tenant_id: UUID, period_start: datetime, period_end: datetime,
    ) -> Invoice:
        """Generate an invoice for a billing period based on usage summaries."""
        sub = await self.get_tenant_subscription(db, tenant_id)
        if not sub:
            raise ValidationError("No active subscription")

        result = await db.execute(
            select(ServiceUsageSummary).where(
                ServiceUsageSummary.tenant_id == tenant_id,
                ServiceUsageSummary.period_start == period_start,
            )
        )
        summaries = list(result.scalars().all())

        line_items = []
        subtotal = sub.plan.base_price if sub.plan else 0.0
        if subtotal > 0:
            line_items.append({
                "description": f"Base plan: {sub.plan.name}",
                "quantity": 1,
                "unit_price": subtotal,
                "amount": subtotal,
            })

        for s in summaries:
            pr_result = await db.execute(
                select(PricingRule).where(
                    PricingRule.plan_id == sub.plan_id,
                    PricingRule.service_type == s.service_type,
                )
            )
            pr = pr_result.scalar_one_or_none()
            if pr and s.total_usage > 0:
                within_quota = min(s.total_usage, pr.quota_limit) if pr.quota_limit > 0 else s.total_usage
                overage = max(0, s.total_usage - pr.quota_limit) if pr.quota_limit > 0 else 0
                usage_cost = within_quota * pr.price_per_unit
                overage_cost = overage * pr.overage_price_per_unit

                line_items.append({
                    "description": f"{s.service_type.value}: {within_quota} calls @ {pr.price_per_unit}/call",
                    "quantity": within_quota,
                    "unit_price": pr.price_per_unit,
                    "amount": round(usage_cost, 2),
                })
                if overage > 0:
                    line_items.append({
                        "description": f"{s.service_type.value} overage: {overage} calls @ {pr.overage_price_per_unit}/call",
                        "quantity": overage,
                        "unit_price": pr.overage_price_per_unit,
                        "amount": round(overage_cost, 2),
                    })
                subtotal += usage_cost + overage_cost

        discount_amount = float(sub.discount_amount) if sub.discount_amount else 0.0
        coupon_code_str = None
        if sub.coupon_id:
            from app.models.billing import DiscountCoupon
            c_result = await db.execute(select(DiscountCoupon).where(DiscountCoupon.id == sub.coupon_id))
            coupon = c_result.scalar_one_or_none()
            coupon_code_str = coupon.code if coupon else None

        total_after_discount = max(0.0, subtotal - discount_amount)
        if discount_amount > 0:
            line_items.append({
                "description": f"Discount (coupon: {coupon_code_str or 'N/A'})",
                "quantity": 1,
                "unit_price": -discount_amount,
                "amount": -discount_amount,
            })

        # Generate invoice number: CIP-{YYYYMM}-{seq}
        now = datetime.now(timezone.utc)
        count_result = await db.execute(
            select(func.count(Invoice.id)).where(
                Invoice.tenant_id == tenant_id,
            )
        )
        seq = (count_result.scalar() or 0) + 1
        invoice_number = f"CIP-{now.strftime('%Y%m')}-{seq:04d}"

        invoice = Invoice(
            tenant_id=tenant_id,
            invoice_number=invoice_number,
            status=InvoiceStatus.draft,
            period_start=period_start,
            period_end=period_end,
            subtotal=round(subtotal, 2),
            discount_amount=round(discount_amount, 2),
            tax_amount=0.0,
            total=round(total_after_discount, 2),
            coupon_code=coupon_code_str,
            line_items=line_items,
        )
        db.add(invoice)
        return invoice

    # --- Internal Helpers ---

    async def _get_or_create_usage_summary(
        self, db: AsyncSession, tenant_id: UUID, service_type: ServiceType,
        period_start: datetime, period_end: datetime, quota_limit: int,
    ) -> ServiceUsageSummary:
        result = await db.execute(
            select(ServiceUsageSummary).where(
                ServiceUsageSummary.tenant_id == tenant_id,
                ServiceUsageSummary.service_type == service_type,
                ServiceUsageSummary.period_start == period_start,
            )
        )
        summary = result.scalar_one_or_none()
        if not summary:
            summary = ServiceUsageSummary(
                tenant_id=tenant_id,
                service_type=service_type,
                period_start=period_start,
                period_end=period_end,
                quota_limit=quota_limit,
            )
            db.add(summary)
            await db.flush()
        return summary


billing_service = BillingService()
