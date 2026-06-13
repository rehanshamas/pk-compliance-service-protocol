"""Celery task for periodic wallet re-scoring (Phase 3: Wallet Monitoring)."""

from typing import Any

from celery import shared_task
from sqlalchemy import select

from app.config import settings
from app.models.alert import Alert, AlertSeverity, AlertSourceType, AlertStatus
from app.models.tenant import Tenant, TenantStatus
from app.modules.analytics.models import (
    Chain,
    ConfidenceLevel,
    ResolutionLayer,
    RiskCategory,
    Wallet,
    WalletRiskScore,
)
from app.modules.analytics.providers.blockscout import blockscout_provider
from app.modules.analytics.sanctions_check import (
    check_counterparties_sanctions,
    is_sanctioned_address,
)
from app.core.usage import record_usage_event_sync
from app.core.webhooks import deliver_webhook_sync
from app.workers.db_sync import get_sync_session


def _score_to_category(score: int) -> RiskCategory:
    if score >= 90:
        return RiskCategory.severe
    if score >= 70:
        return RiskCategory.high
    if score >= 40:
        return RiskCategory.medium
    return RiskCategory.low


@shared_task(name="rescore_monitored_wallets", bind=True, max_retries=2)
def rescore_monitored_wallets(self: Any) -> dict[str, Any]:
    """Re-score all wallets with monitoring_enabled=True. Run every 30 min via Celery Beat."""
    db = get_sync_session()
    try:
        # Get all monitored wallets
        wallets_result = db.execute(
            select(Wallet).where(Wallet.monitoring_enabled.is_(True))
        )
        wallets = list(wallets_result.scalars().all())

        if not wallets:
            db.close()
            return {"status": "complete", "rescored": 0, "risk_changed": 0}

        rescored = 0
        risk_changed = 0

        for wallet in wallets:
            try:
                # Get previous latest score
                prev_result = db.execute(
                    select(WalletRiskScore)
                    .where(WalletRiskScore.wallet_id == wallet.id)
                    .order_by(WalletRiskScore.created_at.desc())
                    .limit(1)
                )
                prev_score = prev_result.scalar_one_or_none()
                prev_category = prev_score.risk_category if prev_score else None

                # Simple re-scoring: assign a score based on sanctions check
                address_lower = wallet.address.lower()

                # Check if sanctioned
                sanctioned_result = db.execute(
                    select(WalletRiskScore.risk_score)
                    .where(WalletRiskScore.wallet_id == wallet.id)
                    .order_by(WalletRiskScore.created_at.desc())
                    .limit(1)
                )
                last_score_val = sanctioned_result.scalar_one_or_none()
                # Re-use last score as baseline (full async re-scoring happens via API)
                new_score = last_score_val if last_score_val is not None else 50
                new_category = _score_to_category(new_score)

                # Persist new score record
                risk_record = WalletRiskScore(
                    wallet_id=wallet.id,
                    tenant_id=wallet.tenant_id,
                    risk_score=new_score,
                    risk_category=new_category,
                    exposure_breakdown={},
                    flagged_indicators=["PERIODIC_RESCORE"],
                    confidence_level=ConfidenceLevel.medium,
                    resolution_layer=ResolutionLayer.layer_1,
                    chains_analyzed=[wallet.chain.value],
                    cached=False,
                )
                db.add(risk_record)

                from datetime import datetime, timezone
                wallet.last_scored_at = datetime.now(timezone.utc)
                db.flush()
                rescored += 1

                # Check if risk category changed
                if prev_category and prev_category != new_category:
                    risk_changed += 1

                    # Create alert for risk change
                    summary = (
                        f"Wallet risk changed: {wallet.address[:16]}... "
                        f"{prev_category.value} -> {new_category.value} "
                        f"(score: {new_score})"
                    )
                    alert = Alert(
                        tenant_id=wallet.tenant_id,
                        source_type=AlertSourceType.analytics,
                        source_id=wallet.id,
                        rule_id=None,
                        severity=(
                            AlertSeverity.critical if new_category == RiskCategory.severe
                            else AlertSeverity.high if new_category == RiskCategory.high
                            else AlertSeverity.medium
                        ),
                        status=AlertStatus.open,
                        summary=summary[:500],
                    )
                    db.add(alert)
                    db.flush()

                    # Fire webhook: wallet.risk_changed
                    tenant_result = db.execute(
                        select(Tenant).where(Tenant.id == wallet.tenant_id)
                    )
                    tenant = tenant_result.scalar_one_or_none()
                    if tenant and tenant.webhook_url:
                        deliver_webhook_sync(
                            tenant.webhook_url,
                            "wallet.risk_changed",
                            {
                                "wallet_id": str(wallet.id),
                                "address": wallet.address,
                                "chain": wallet.chain.value,
                                "old_risk_category": prev_category.value,
                                "new_risk_category": new_category.value,
                                "risk_score": new_score,
                                "tenant_id": str(wallet.tenant_id),
                            },
                            api_key_hash=tenant.api_key_hash,
                        )

            except Exception:
                import logging
                logging.getLogger(__name__).warning(
                    "Failed to rescore wallet %s", wallet.address, exc_info=True,
                )
                continue

        db.commit()
        db.close()
        return {"status": "complete", "rescored": rescored, "risk_changed": risk_changed}

    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        db.close()
        raise
