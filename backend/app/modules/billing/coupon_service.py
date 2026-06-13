"""Discount coupon service: CRUD, validation, apply to subscription."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.models.billing import (
    DiscountCoupon,
    CouponRedemption,
    TenantSubscription,
    ServicePlan,
)


class CouponService:
    async def list(
        self,
        db: AsyncSession,
        active_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[DiscountCoupon], int]:
        """List coupons with optional active filter."""
        from sqlalchemy import func

        base = select(DiscountCoupon)
        count_stmt = select(func.count()).select_from(DiscountCoupon)
        if active_only:
            now = datetime.now(timezone.utc)
            filt = (
                DiscountCoupon.is_active.is_(True),
                (DiscountCoupon.valid_from.is_(None)) | (DiscountCoupon.valid_from <= now),
                (DiscountCoupon.valid_until.is_(None)) | (DiscountCoupon.valid_until >= now),
            )
            base = base.where(*filt)
            count_stmt = count_stmt.where(*filt)
        total = (await db.scalar(count_stmt)) or 0
        base = base.order_by(DiscountCoupon.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(base)
        return list(result.scalars().all()), total

    async def get(self, db: AsyncSession, coupon_id: UUID) -> DiscountCoupon:
        r = await db.execute(select(DiscountCoupon).where(DiscountCoupon.id == coupon_id))
        c = r.scalar_one_or_none()
        if not c:
            raise NotFoundError("Coupon not found")
        return c

    async def get_by_code(self, db: AsyncSession, code: str) -> DiscountCoupon | None:
        r = await db.execute(
            select(DiscountCoupon).where(
                DiscountCoupon.code == code.strip().upper(),
                DiscountCoupon.is_active.is_(True),
            )
        )
        return r.scalar_one_or_none()

    async def validate(
        self,
        db: AsyncSession,
        code: str,
        plan_id: UUID,
        tenant_id: UUID,
    ) -> tuple[DiscountCoupon, float]:
        """Validate coupon and return (coupon, discount_amount). Raises ValidationError if invalid."""
        coupon = await self.get_by_code(db, code)
        if not coupon:
            raise ValidationError("Invalid or expired coupon code")

        now = datetime.now(timezone.utc)
        if coupon.valid_from and now < coupon.valid_from:
            raise ValidationError("Coupon not yet valid")
        if coupon.valid_until and now > coupon.valid_until:
            raise ValidationError("Coupon has expired")
        if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
            raise ValidationError("Coupon has reached maximum uses")

        if coupon.plan_ids is not None and len(coupon.plan_ids) > 0:
            plan_ids_str = [str(p) for p in coupon.plan_ids]
            if str(plan_id) not in plan_ids_str:
                raise ValidationError("Coupon not valid for this plan")

        # Get plan base price to compute discount
        r = await db.execute(select(ServicePlan).where(ServicePlan.id == plan_id))
        plan = r.scalar_one_or_none()
        if not plan:
            raise NotFoundError("Plan not found")

        base_price = float(plan.base_price)
        if coupon.discount_type == "percent":
            discount = base_price * (coupon.discount_value / 100.0)
        else:
            discount = min(coupon.discount_value, base_price)

        return coupon, round(discount, 2)

    async def create(
        self,
        db: AsyncSession,
        code: str,
        discount_type: str,
        discount_value: float,
        *,
        description: str | None = None,
        valid_from: datetime | None = None,
        valid_until: datetime | None = None,
        max_uses: int | None = None,
        plan_ids: list[UUID] | None = None,
    ) -> DiscountCoupon:
        """Create coupon. Code is normalized to uppercase."""
        code_upper = code.strip().upper()
        if not code_upper:
            raise ValidationError("Coupon code cannot be empty")

        r = await db.execute(select(DiscountCoupon).where(DiscountCoupon.code == code_upper))
        if r.scalar_one_or_none():
            raise ValidationError("Coupon code already exists")

        if discount_type not in ("percent", "fixed"):
            raise ValidationError("discount_type must be 'percent' or 'fixed'")
        if discount_value <= 0:
            raise ValidationError("discount_value must be positive")
        if discount_type == "percent" and discount_value > 100:
            raise ValidationError("Percent discount cannot exceed 100")

        plan_ids_json = [str(p) for p in plan_ids] if plan_ids else None

        coupon = DiscountCoupon(
            code=code_upper,
            description=description,
            discount_type=discount_type,
            discount_value=discount_value,
            valid_from=valid_from,
            valid_until=valid_until,
            max_uses=max_uses,
            plan_ids=plan_ids_json,
        )
        db.add(coupon)
        await db.flush()
        return coupon

    async def update(
        self,
        db: AsyncSession,
        coupon_id: UUID,
        *,
        description: str | None = None,
        valid_from: datetime | None = None,
        valid_until: datetime | None = None,
        max_uses: int | None = None,
        plan_ids: list[UUID] | None = None,
        is_active: bool | None = None,
    ) -> DiscountCoupon:
        coupon = await self.get(db, coupon_id)
        if description is not None:
            coupon.description = description
        if valid_from is not None:
            coupon.valid_from = valid_from
        if valid_until is not None:
            coupon.valid_until = valid_until
        if max_uses is not None:
            coupon.max_uses = max_uses
        if plan_ids is not None:
            coupon.plan_ids = [str(p) for p in plan_ids] if plan_ids else None
        if is_active is not None:
            coupon.is_active = is_active
        await db.flush()
        return coupon

    async def delete(self, db: AsyncSession, coupon_id: UUID) -> None:
        coupon = await self.get(db, coupon_id)
        await db.delete(coupon)
        await db.flush()

    async def record_redemption(
        self,
        db: AsyncSession,
        coupon_id: UUID,
        tenant_id: UUID,
        subscription_id: UUID | None,
        discount_applied: float,
    ) -> None:
        """Record a coupon redemption and increment used_count."""
        coupon = await self.get(db, coupon_id)
        coupon.used_count = (coupon.used_count or 0) + 1
        redemption = CouponRedemption(
            coupon_id=coupon_id,
            tenant_id=tenant_id,
            subscription_id=subscription_id,
            discount_applied=discount_applied,
        )
        db.add(redemption)
        await db.flush()


coupon_service = CouponService()
