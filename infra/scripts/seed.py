#!/usr/bin/env python3
"""Seed development database: tenants, users, watchlist. Run from compliance/: make seed."""

import asyncio
import os
import sys

# Ensure backend app is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

from sqlalchemy import select

from app.database import async_session_maker, engine, init_db
from app.models.tenant import Tenant, TenantStatus, User, UserRole
from app.models.screening import WatchlistEntry, WatchlistSource, IngestionHealth, IngestionSource, EntityType
from app.models.billing import ServicePlan, PricingRule, ServiceType, BillingCycle, TenantSubscription
from app.modules.auth.service import hash_password


async def seed() -> None:
    await init_db()

    default_flags = {
        "identity_enabled": True,
        "screening_enabled": True,
        "analytics_enabled": True,
        "compliance_enabled": True,
        "analytics_commercial_fallback": False,
        "ongoing_monitoring_enabled": True,
    }

    async with async_session_maker() as session:
        # Check if already seeded
        result = await session.execute(select(Tenant).limit(1))
        if result.scalar_one_or_none():
            print("Tenants already seeded. Skipping tenants/users.")
        else:
            tenant1 = Tenant(
                name="CryptoExchange PK",
                slug="cryptoexchange-pk",
                status=TenantStatus.active,
                feature_flags=default_flags.copy(),
            )
            session.add(tenant1)
            await session.flush()

            tenant2 = Tenant(
                name="DigitalVault PK",
                slug="digitalvault-pk",
                status=TenantStatus.trial,
                feature_flags=default_flags.copy(),
            )
            session.add(tenant2)
            await session.flush()

            mlro = User(
                tenant_id=tenant1.id,
                email="mlro@vasp.pk",
                password_hash=hash_password("demo123"),
                full_name="Ahmed Hassan",
                role=UserRole.mlro,
                is_active=True,
            )
            session.add(mlro)
            admin = User(
                tenant_id=None,
                email="admin@cip.pk",
                password_hash=hash_password("admin123"),
                full_name="Platform Admin",
                role=UserRole.platform_admin,
                is_active=True,
            )
            session.add(admin)
            analyst = User(
                tenant_id=tenant1.id,
                email="analyst@vasp.pk",
                password_hash=hash_password("demo123"),
                full_name="Sara Khan",
                role=UserRole.analyst,
                is_active=True,
            )
            session.add(analyst)
            print("Seeded: 2 tenants, 3 users")

        # Seed watchlist + ingestion_health if empty
        wl_check = await session.execute(select(WatchlistEntry).limit(1))
        if not wl_check.scalar_one_or_none():
            for src in IngestionSource:
                session.add(IngestionHealth(source=src, status="pending", records_count=0))
            session.add(WatchlistEntry(
                source=WatchlistSource.un,
                entity_type=EntityType.individual,
                primary_name="Muhammad Ahmed Khan",
                aliases=["Ahmed Khan", "M. A. Khan"],
            ))
            session.add(WatchlistEntry(
                source=WatchlistSource.ofac,
                entity_type=EntityType.individual,
                primary_name="Abdul Rahman Al-Saud",
                aliases=[],
            ))
            session.add(WatchlistEntry(
                source=WatchlistSource.pep,
                entity_type=EntityType.individual,
                primary_name="Imran Khan",
                aliases=["Imran Ahmad Khan Niazi"],
            ))
            print("Seeded: watchlist (3 entries), ingestion_health (5 sources)")

        # Seed billing plans if empty
        plan_check = await session.execute(select(ServicePlan).limit(1))
        if not plan_check.scalar_one_or_none():
            from datetime import datetime, timedelta, timezone

            now = datetime.now(timezone.utc)

            # Trial plan — 10 calls per service, free
            trial_plan = ServicePlan(
                name="Trial",
                description="14-day free trial with 10 calls per service",
                is_default=False,
                is_trial=True,
                billing_cycle=BillingCycle.monthly,
                base_price=0.0,
            )
            session.add(trial_plan)
            await session.flush()
            for stype in ServiceType:
                session.add(PricingRule(
                    plan_id=trial_plan.id, service_type=stype,
                    included_in_plan=True, price_per_unit=0.0,
                    quota_limit=10, overage_price_per_unit=0.0,
                ))

            # Starter plan — KYC included, add-ons available
            starter_plan = ServicePlan(
                name="Starter",
                description="KYC included. Screening, analytics, reports, forms billed per use.",
                is_default=True,
                is_trial=False,
                billing_cycle=BillingCycle.monthly,
                base_price=25000.0,  # PKR 25,000/month base
            )
            session.add(starter_plan)
            await session.flush()
            starter_rules = [
                (ServiceType.kyc, True, 50.0, 500, 75.0),
                (ServiceType.screening, True, 20.0, 1000, 30.0),
                (ServiceType.analytics_l1, True, 10.0, 500, 15.0),
                (ServiceType.analytics_l3, True, 500.0, 50, 750.0),
                (ServiceType.reports, True, 200.0, 100, 300.0),
                (ServiceType.form_generation, True, 100.0, 50, 150.0),
            ]
            for stype, included, price, quota, overage in starter_rules:
                session.add(PricingRule(
                    plan_id=starter_plan.id, service_type=stype,
                    included_in_plan=included, price_per_unit=price,
                    quota_limit=quota, overage_price_per_unit=overage,
                ))

            # Professional plan — higher quotas, lower per-unit
            pro_plan = ServicePlan(
                name="Professional",
                description="Higher quotas, lower per-unit pricing. For growing VASPs.",
                is_default=False,
                is_trial=False,
                billing_cycle=BillingCycle.monthly,
                base_price=75000.0,  # PKR 75,000/month base
            )
            session.add(pro_plan)
            await session.flush()
            pro_rules = [
                (ServiceType.kyc, True, 35.0, 2000, 50.0),
                (ServiceType.screening, True, 15.0, 5000, 20.0),
                (ServiceType.analytics_l1, True, 7.0, 2000, 10.0),
                (ServiceType.analytics_l3, True, 400.0, 200, 600.0),
                (ServiceType.reports, True, 150.0, 500, 200.0),
                (ServiceType.form_generation, True, 75.0, 200, 100.0),
            ]
            for stype, included, price, quota, overage in pro_rules:
                session.add(PricingRule(
                    plan_id=pro_plan.id, service_type=stype,
                    included_in_plan=included, price_per_unit=price,
                    quota_limit=quota, overage_price_per_unit=overage,
                ))

            # Enterprise plan — unlimited, custom pricing
            ent_plan = ServicePlan(
                name="Enterprise",
                description="Unlimited quotas, dedicated support, custom pricing.",
                is_default=False,
                is_trial=False,
                billing_cycle=BillingCycle.monthly,
                base_price=200000.0,  # PKR 200,000/month base
            )
            session.add(ent_plan)
            await session.flush()
            ent_rules = [
                (ServiceType.kyc, True, 25.0, 0, 25.0),
                (ServiceType.screening, True, 10.0, 0, 10.0),
                (ServiceType.analytics_l1, True, 5.0, 0, 5.0),
                (ServiceType.analytics_l3, True, 300.0, 0, 300.0),
                (ServiceType.reports, True, 100.0, 0, 100.0),
                (ServiceType.form_generation, True, 50.0, 0, 50.0),
            ]
            for stype, included, price, quota, overage in ent_rules:
                session.add(PricingRule(
                    plan_id=ent_plan.id, service_type=stype,
                    included_in_plan=included, price_per_unit=price,
                    quota_limit=0, overage_price_per_unit=overage,
                ))

            # Assign Trial plan to existing tenants
            tenants_result = await session.execute(select(Tenant))
            for tenant in tenants_result.scalars().all():
                sub = TenantSubscription(
                    tenant_id=tenant.id,
                    plan_id=trial_plan.id,
                    billing_cycle=BillingCycle.monthly,
                    current_period_start=now,
                    current_period_end=now + timedelta(days=30),
                    trial_ends_at=now + timedelta(days=14),
                    grace_period_hours=48,
                )
                session.add(sub)

            print("Seeded: 4 billing plans (Trial, Starter, Professional, Enterprise) + tenant subscriptions")

        await session.commit()
        print("  MLRO: mlro@vasp.pk / demo123")
        print("  Admin: admin@cip.pk / admin123")
        print("  Analyst: analyst@vasp.pk / demo123")


async def main() -> None:
    await seed()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
