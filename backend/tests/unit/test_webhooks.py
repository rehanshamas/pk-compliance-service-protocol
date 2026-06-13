"""Unit tests for webhook delivery (Phase 4.11)."""

import pytest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from app.core.webhooks import (
    _customer_snapshot,
    deliver_webhook,
    schedule_kyc_webhook,
)


def test_customer_snapshot():
    """_customer_snapshot builds correct dict from customer-like object."""
    class MockCustomer:
        id = uuid4()
        tenant_id = uuid4()
        full_name = "Test User"
        nationality = "PK"
        risk_tier = type("T", (), {"value": "medium"})()
        kyc_status = type("S", (), {"value": "approved"})()

    snap = _customer_snapshot(MockCustomer())
    assert snap["fullName"] == "Test User"
    assert snap["nationality"] == "PK"
    assert snap["riskTier"] == "medium"
    assert snap["kycStatus"] == "approved"
    assert "id" in snap
    assert "tenantId" in snap


def test_schedule_kyc_webhook_skips_empty_url():
    """schedule_kyc_webhook does nothing when url is None or empty."""
    with patch("app.core.webhooks.asyncio.create_task") as mock_create:
        schedule_kyc_webhook(None, uuid4(), uuid4(), "initiated", "approved", {})
        schedule_kyc_webhook("", uuid4(), uuid4(), "initiated", "approved", {})
        schedule_kyc_webhook("  ", uuid4(), uuid4(), "initiated", "approved", {})
        mock_create.assert_not_called()


@pytest.mark.asyncio
async def test_deliver_webhook_success():
    """deliver_webhook returns True on 2xx response."""
    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_resp = AsyncMock()
        mock_resp.status_code = 200
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_cls.return_value = mock_client

        result = await deliver_webhook("https://example.com/webhook", {"event": "test"})
        assert result is True
        mock_client.post.assert_called_once()


@pytest.mark.asyncio
async def test_deliver_webhook_retries_on_failure():
    """deliver_webhook retries up to 3 times on failure."""
    with patch("app.core.webhooks.asyncio.sleep", new_callable=AsyncMock):
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_resp = AsyncMock()
            mock_resp.status_code = 200
            mock_resp.text = "OK"
            mock_client = AsyncMock()
            # First 2 calls fail, 3rd succeeds
            mock_client.post = AsyncMock(
                side_effect=[Exception("timeout"), Exception("timeout"), mock_resp]
            )
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_cls.return_value = mock_client

            result = await deliver_webhook("https://example.com/webhook", {"event": "test"})
            assert result is True
            assert mock_client.post.call_count == 3
