"""Auto-freeze mechanism: checks thresholds and triggers customer freeze + VASP notification."""

import logging
from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert, AlertSeverity, AlertSourceType, AlertStatus
from app.models.tenant import Tenant
from app.modules.identity.models import Customer, FreezeRecord, KycStatus

logger = logging.getLogger(__name__)


async def check_auto_freeze(
    tenant: Tenant,
    customer_id: UUID | None,
    trigger_type: str,
    score: int | float,
    db: AsyncSession,
    *,
    source_id: UUID | None = None,
    matched_name: str | None = None,
    matched_list: str | None = None,
) -> bool:
    """
    Called after wallet scoring or screening. Checks if auto-freeze thresholds are met.
    If yes, freezes customer + calls VASP endpoint + fires webhook.

    trigger_type: "wallet_risk" | "screening_match" | "sanctions_true_positive"
    Returns True if freeze was triggered.
    """
    config = (tenant.feature_flags or {}).get("auto_freeze", {})
    if not config.get("enabled"):
        return False

    if not customer_id:
        return False

    thresholds = config.get("thresholds", {})
    should_freeze = False

    if trigger_type == "wallet_risk" and score >= thresholds.get("wallet_risk_score_min", 999):
        should_freeze = True
    elif trigger_type == "screening_match" and score >= thresholds.get("screening_match_score_min", 999):
        should_freeze = True
    elif trigger_type == "sanctions_true_positive" and thresholds.get("sanctions_true_positive"):
        should_freeze = True

    if not should_freeze:
        return False

    # 1. Freeze customer in CIP
    result = await db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.tenant_id == tenant.id,
        )
    )
    customer = result.scalar_one_or_none()
    if not customer:
        logger.warning("Auto-freeze: customer %s not found for tenant %s", customer_id, tenant.id)
        return False

    if customer.kyc_status == KycStatus.frozen:
        logger.info("Auto-freeze: customer %s already frozen", customer_id)
        return False

    old_status = customer.kyc_status.value if hasattr(customer.kyc_status, "value") else str(customer.kyc_status)
    customer.kyc_status = KycStatus.frozen
    await db.flush()

    # Create freeze record
    fr = FreezeRecord(
        tenant_id=tenant.id,
        customer_id=customer_id,
        screening_result_id=source_id,
        freeze_type=f"auto_{trigger_type}",
        matched_list=matched_list,
        matched_name=matched_name or customer.full_name,
        match_score=float(score),
        status="frozen",
        notes=f"Auto-freeze triggered by {trigger_type} (score: {score})",
    )
    db.add(fr)
    await db.flush()

    # 4. Create alert
    summary = (
        f"AUTO-FREEZE: {customer.full_name} frozen automatically. "
        f"Trigger: {trigger_type}, score: {score}. "
        f"Previous status: {old_status}."
    )
    alert = Alert(
        tenant_id=tenant.id,
        source_type=AlertSourceType.screening if "screening" in trigger_type else AlertSourceType.analytics,
        source_id=source_id or customer_id,
        rule_id=None,
        severity=AlertSeverity.critical,
        status=AlertStatus.open,
        summary=summary[:500],
    )
    db.add(alert)
    await db.flush()

    # 2. Call VASP endpoint if configured
    vasp_endpoint = config.get("vasp_freeze_endpoint")
    vasp_auth = config.get("vasp_freeze_auth_token")
    if vasp_endpoint:
        try:
            headers = {"Content-Type": "application/json"}
            if vasp_auth:
                headers["Authorization"] = vasp_auth
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    vasp_endpoint,
                    json={
                        "event": "compliance.freeze_triggered",
                        "customer_id": str(customer_id),
                        "customer_name": customer.full_name,
                        "trigger_type": trigger_type,
                        "score": score,
                        "tenant_id": str(tenant.id),
                        "frozen_at": datetime.now(timezone.utc).isoformat(),
                    },
                    headers=headers,
                )
                logger.info(
                    "Auto-freeze VASP endpoint response: %d for customer %s",
                    resp.status_code,
                    customer_id,
                )
        except Exception:
            logger.warning(
                "Auto-freeze: failed to call VASP endpoint %s", vasp_endpoint, exc_info=True
            )

    # 3. Fire webhook: compliance.freeze_triggered
    if tenant.webhook_url:
        try:
            from app.workers.tasks.webhooks import deliver_webhook_task
            deliver_webhook_task.delay(
                tenant.webhook_url,
                "compliance.freeze_triggered",
                {
                    "customer_id": str(customer_id),
                    "customer_name": customer.full_name,
                    "trigger_type": trigger_type,
                    "score": score,
                    "tenant_id": str(tenant.id),
                    "old_status": old_status,
                    "frozen_at": datetime.now(timezone.utc).isoformat(),
                },
                tenant.api_key_hash,
            )
        except Exception:
            logger.warning("Auto-freeze: webhook dispatch failed", exc_info=True)

    # 5. Log in audit trail
    logger.info(
        "AUTO-FREEZE completed: customer=%s tenant=%s trigger=%s score=%s",
        customer_id, tenant.id, trigger_type, score,
    )

    return True
