"""Integration tests for analytics (wallets) API. Phase 6.1."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_wallets_score_requires_auth():
    """POST /wallets/score without auth returns 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        resp = await client.post(
            "/api/v1/wallets/score",
            json={"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2b3E7", "chain": "ethereum"},
        )
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_wallets_score_success():
    """POST /wallets/score as tenant user returns risk score. Phase 6.1."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "mlro@vasp.pk", "password": "demo123"},
        )
        if login.status_code != 200:
            pytest.skip("Run make seed")
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        resp = await client.post(
            "/api/v1/wallets/score",
            headers=headers,
            json={"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2b3E7", "chain": "ethereum"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "walletId" in data
        assert "address" in data
        assert "riskScore" in data
        assert 0 <= data["riskScore"] <= 100
        assert data["riskCategory"] in ("low", "medium", "high", "severe")
        assert "exposureBreakdown" in data
        assert "resolutionLayer" in data
        assert data["resolutionLayer"] == "layer_1"


@pytest.mark.asyncio
async def test_wallets_list_and_detail():
    """GET /wallets list, then GET /wallets/{address} detail. Phase 6.1."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "mlro@vasp.pk", "password": "demo123"},
        )
        if login.status_code != 200:
            pytest.skip("Run make seed")
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        # Score a wallet first
        score_resp = await client.post(
            "/api/v1/wallets/score",
            headers=headers,
            json={"address": "0xABCD1234567890abcdef1234567890abcdef12", "chain": "ethereum"},
        )
        if score_resp.status_code != 200:
            pytest.skip(f"Score failed: {score_resp.json()}")
        addr = score_resp.json()["address"]
        # List wallets
        list_resp = await client.get("/api/v1/wallets", headers=headers)
        assert list_resp.status_code == 200
        list_data = list_resp.json()
        assert "items" in list_data
        assert "total" in list_data
        assert list_data["total"] >= 1
        # Get wallet detail
        detail_resp = await client.get(f"/api/v1/wallets/{addr}", headers=headers)
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        assert detail["address"] == addr
        assert "scoreHistory" in detail
        assert len(detail["scoreHistory"]) >= 1
