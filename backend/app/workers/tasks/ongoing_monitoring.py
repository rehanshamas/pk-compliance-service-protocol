"""Celery task for ongoing monitoring: re-screen active customers when lists update (Phase 3.12)."""

from typing import Any

from celery import shared_task
from sqlalchemy import select

from app.config import settings
from app.models.screening import (
    OverallStatus,
    ScreeningResult,
    ScreeningType,
    WatchlistEntry,
)
from app.models.tenant import Tenant, TenantStatus
from app.modules.identity.models import Customer, KycStatus
from app.modules.screening.matching import find_matches
from app.modules.alerts.service import create_alert_for_screening_sync
from app.core.usage import record_usage_event_sync
from app.workers.db_sync import get_sync_session


def _get_threshold() -> float:
    return getattr(settings, "screening_fuzzy_threshold", 70.0)


# Active customers: approved, EDD in progress, or EDD required (we still serve them)
ACTIVE_STATUSES = (KycStatus.approved, KycStatus.edd_required, KycStatus.edd_in_progress)


@shared_task(name="run_ongoing_monitoring", bind=True, max_retries=3)
def run_ongoing_monitoring(self: Any) -> dict[str, Any]:
    """
    Re-screen active customers for tenants with ongoing_monitoring_enabled.
    Creates ScreeningResults (ongoing_monitoring) and alerts for matches.
    """
    db = get_sync_session()
    try:
        # Tenants with ongoing monitoring enabled
        tenants_result = db.execute(select(Tenant).where(Tenant.status != TenantStatus.terminated))
        tenants = [t for t in tenants_result.scalars().all()
                   if (t.feature_flags or {}).get("ongoing_monitoring_enabled") is True]

        if not tenants:
            db.close()
            return {"status": "complete", "tenants": 0, "screened": 0}

        # Load watchlist
        wl_result = db.execute(
            select(
                WatchlistEntry.id,
                WatchlistEntry.primary_name,
                WatchlistEntry.aliases,
                WatchlistEntry.source,
            )
        )
        wl_rows = wl_result.all()
        entries = [
            (str(r.id), r.primary_name, r.aliases or [], r.source.value if r.source else "")
            for r in wl_rows
        ]
        threshold = _get_threshold()

        total_screened = 0
        for tenant in tenants:
            cust_result = db.execute(
                select(Customer).where(
                    Customer.tenant_id == tenant.id,
                    Customer.kyc_status.in_(ACTIVE_STATUSES),
                )
            )
            customers = cust_result.scalars().all()

            for cust in customers:
                if not cust.full_name or not cust.full_name.strip():
                    continue
                name = cust.full_name.strip()
                dob = cust.dob.isoformat() if cust.dob else None
                id_number = cust.cnic_number

                matches_data = find_matches(
                    name,
                    entries,
                    threshold=threshold,
                    use_aliases=True,
                )
                overall = (
                    OverallStatus.potential_match
                    if matches_data
                    else OverallStatus.clear
                )

                sr = ScreeningResult(
                    tenant_id=tenant.id,
                    screened_entity_name=name,
                    screened_entity_dob=dob,
                    screened_entity_id=id_number,
                    screening_type=ScreeningType.ongoing_monitoring,
                    matches=matches_data,
                    overall_status=overall,
                )
                db.add(sr)
                db.flush()

                if matches_data:
                    create_alert_for_screening_sync(db, tenant.id, sr)
                    # Fire webhook: screening.ongoing_match
                    if tenant.webhook_url:
                        try:
                            from app.core.webhooks import deliver_webhook_sync
                            deliver_webhook_sync(
                                tenant.webhook_url,
                                "screening.ongoing_match",
                                {
                                    "screening_result_id": str(sr.id),
                                    "tenant_id": str(tenant.id),
                                    "screened_entity_name": name,
                                    "match_count": len(matches_data),
                                    "overall_status": overall.value,
                                    "matches": matches_data,
                                },
                                api_key_hash=tenant.api_key_hash,
                            )
                        except Exception:
                            pass  # Non-fatal

                total_screened += 1

            if customers:
                record_usage_event_sync(
                    db,
                    tenant.id,
                    "screening.ongoing_monitoring",
                    quantity=float(len(customers)),
                    metadata={"tenant_id": str(tenant.id)},
                )
                db.commit()

        db.close()
        return {"status": "complete", "tenants": len(tenants), "screened": total_screened}

    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        db.close()
        raise
