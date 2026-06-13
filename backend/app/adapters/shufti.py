"""Shufti Pro e-IDV adapter. NADRA fallback when sandbox unavailable.

Phase 7 — e-IDV Pro: electronic identity vs government data sources.
Docs: https://developers.shuftipro.com/docs/user_identification_authentication/eidv_pro/
"""

import hashlib
import logging
import base64
from dataclasses import dataclass
from uuid import uuid4

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

SHUFTI_EIDV_PROVIDER = "shufti_eidv_pro"


@dataclass
class ShuftiCreateResult:
    """Result of creating a Shufti e-IDV verification request."""

    verification_url: str
    reference: str
    access_token: str | None = None
    event: str | None = None


def _verify_signature(raw_body: str, signature_header: str | None, secret_key: str) -> bool:
    """Verify Shufti callback signature. SHA256(response + SHA256(secret_key))."""
    if not signature_header or not secret_key:
        return False
    try:
        secret_hash = hashlib.sha256(secret_key.encode()).hexdigest()
        concatenated = raw_body + secret_hash
        expected = hashlib.sha256(concatenated.encode()).hexdigest()
        return expected == signature_header
    except Exception:
        return False


async def create_eidv_request(
    *,
    reference: str,
    callback_url: str,
    country: str = "PK",
    verification_mode: str = "any",
    redirect_url: str | None = None,
) -> ShuftiCreateResult:
    """
    Create Shufti e-IDV Pro verification request. Offsite mode (user completes on Shufti page).

    Returns verification_url for frontend to redirect user. Callback receives final result.
    """
    client_id = getattr(settings, "shufti_client_id", "") or ""
    secret_key = getattr(settings, "shufti_secret_key", "") or ""
    base_url = (getattr(settings, "shufti_base_url", "") or "https://api.shuftipro.com").rstrip("/")

    if not client_id or not secret_key:
        raise ValueError("SHUFTI_CLIENT_ID and SHUFTI_SECRET_KEY must be set for Shufti e-IDV")

    if not callback_url:
        raise ValueError("Callback URL required for Shufti e-IDV (set SHUFTI_CALLBACK_URL)")

    payload = {
        "reference": reference,
        "callback_url": callback_url,
        "country": country,
        "show_results": "0",  # Async: callback only, no inline result
        "eidv_pro": {
            "verification_mode": verification_mode,
            "allow_offline": "0",
        },
    }
    if redirect_url:
        payload["redirect_url"] = redirect_url

    auth = base64.b64encode(f"{client_id}:{secret_key}".encode()).decode()
    headers = {
        "Authorization": f"Basic {auth}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{base_url}",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

    event = data.get("event")
    verification_url = data.get("verification_url") or data.get("verification_URL") or ""
    access_token = data.get("access_token")

    if not verification_url:
        logger.warning("Shufti response missing verification_url: %s", data)
        raise ValueError("Shufti did not return verification_url")

    return ShuftiCreateResult(
        verification_url=verification_url,
        reference=reference,
        access_token=access_token,
        event=event,
    )


def generate_reference() -> str:
    """Generate unique reference (6-250 chars)."""
    return f"cip_{uuid4().hex}"[:64]
