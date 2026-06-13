"""Integration tests for billing API endpoints."""

import os

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

pytestmark = pytest.mark.skipif(
    os.getenv("CIP_SKIP_INTEGRATION", "").lower() in ("1", "true"),
    reason="Integration tests skipped",
)

BASE = "http://test"


async def _login(client, email, password):
    resp = await client.post(f"{BASE}/api/v1/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        pytest.skip("Seed data not available — run make seed")
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.mark.asyncio
async def test_billing_plans_requires_admin():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as client:
        headers = await _login(client, "mlro@vasp.pk", "demo123")
        resp = await client.get(f"{BASE}/api/v1/billing/plans", headers=headers)
        assert resp.status_code == 403


@pytest.mark.asyncio
async def test_billing_plans_admin_access():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as client:
        headers = await _login(client, "admin@cip.pk", "admin123")
        resp = await client.get(f"{BASE}/api/v1/billing/plans", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)


@pytest.mark.asyncio
async def test_my_usage_authenticated():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as client:
        headers = await _login(client, "mlro@vasp.pk", "demo123")
        resp = await client.get(f"{BASE}/api/v1/billing/usage/me", headers=headers)
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_my_usage_unauthenticated():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as client:
        resp = await client.get(f"{BASE}/api/v1/billing/usage/me")
        assert resp.status_code == 401
