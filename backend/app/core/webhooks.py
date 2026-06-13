"""Webhook delivery service — delivers events to tenant webhook URLs."""

import asyncio
import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
INITIAL_BACKOFF_SEC = 1
BACKOFF_MULTIPLIER = 2
REQUEST_TIMEOUT_SEC = 15


def _sign_payload(payload: bytes, secret: str) -> str:
    """HMAC-SHA256 signature for webhook payload verification."""
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


def deliver_webhook_sync(
    webhook_url: str,
    event_type: str,
    data: dict,
    api_key_hash: str | None = None,
) -> dict:
    """Deliver a webhook (synchronous, for Celery tasks).

    Returns dict with: success (bool), status_code, error.
    """
    payload = json.dumps({
        "event": event_type,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }).encode()

    headers = {
        "Content-Type": "application/json",
        "X-CIP-Event": event_type,
    }
    if api_key_hash:
        headers["X-CIP-Signature"] = _sign_payload(payload, api_key_hash)

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(webhook_url, content=payload, headers=headers)
            return {
                "success": 200 <= response.status_code < 300,
                "status_code": response.status_code,
                "error": None,
            }
    except Exception as e:
        return {"success": False, "status_code": None, "error": str(e)}


def _customer_snapshot(customer) -> dict:
    """Build minimal customer snapshot for webhook payload."""
    return {
        "id": str(customer.id),
        "tenantId": str(customer.tenant_id),
        "fullName": customer.full_name,
        "nationality": customer.nationality,
        "riskTier": customer.risk_tier.value if hasattr(customer.risk_tier, "value") else str(customer.risk_tier),
        "kycStatus": customer.kyc_status.value if hasattr(customer.kyc_status, "value") else str(customer.kyc_status),
    }


async def get_tenant_webhook_url(db: AsyncSession, tenant_id: UUID) -> str | None:
    """Fetch tenant's webhook URL."""
    result = await db.execute(select(Tenant.webhook_url).where(Tenant.id == tenant_id))
    row = result.one_or_none()
    url = row[0] if row else None
    return url if url and str(url).strip() else None


async def notify_kyc_status_change(db: AsyncSession, customer, old_status: str) -> None:
    """Schedule webhook when KYC status changes. Fire-and-forget."""
    url = await get_tenant_webhook_url(db, customer.tenant_id)
    if url:
        schedule_kyc_webhook(
            url,
            customer.id,
            customer.tenant_id,
            old_status,
            customer.kyc_status.value if hasattr(customer.kyc_status, "value") else str(customer.kyc_status),
            _customer_snapshot(customer),
        )


async def deliver_webhook(url: str, payload: dict) -> bool:
    """
    POST payload to webhook URL. 3 retries with exponential backoff.
    Returns True if delivered successfully, False otherwise.
    """
    last_error = None
    delay = INITIAL_BACKOFF_SEC
    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SEC) as client:
                resp = await client.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json", "User-Agent": "CIP-Webhook/1.0"},
                )
                if 200 <= resp.status_code < 300:
                    logger.info("Webhook delivered to %s (attempt %d)", url, attempt + 1)
                    return True
                last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
        except Exception as e:
            last_error = str(e)
            logger.warning("Webhook attempt %d failed: %s", attempt + 1, last_error)
        if attempt < MAX_RETRIES - 1:
            await asyncio.sleep(delay)
            delay *= BACKOFF_MULTIPLIER
    logger.error("Webhook failed after %d attempts to %s: %s", MAX_RETRIES, url, last_error)
    return False


def schedule_kyc_webhook(
    webhook_url: str | None,
    customer_id: UUID,
    tenant_id: UUID,
    old_status: str,
    new_status: str,
    customer_snapshot: dict,
) -> None:
    """
    Fire-and-forget: schedule webhook delivery in background.
    Skips if webhook_url is None or empty.
    """
    if not webhook_url or not webhook_url.strip():
        return
    payload = {
        "event": "kyc.status_changed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": {
            "customerId": str(customer_id),
            "tenantId": str(tenant_id),
            "oldStatus": old_status,
            "newStatus": new_status,
            "customer": customer_snapshot,
        },
    }
    asyncio.create_task(deliver_webhook(webhook_url.strip(), payload))
