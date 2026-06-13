"""Integration tests for system settings API."""

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
async def test_settings_requires_admin():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as client:
        headers = await _login(client, "mlro@vasp.pk", "demo123")
        resp = await client.get(f"{BASE}/api/v1/admin/settings", headers=headers)
        assert resp.status_code == 403


@pytest.mark.asyncio
async def test_settings_list():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as client:
        headers = await _login(client, "admin@cip.pk", "admin123")
        resp = await client.get(f"{BASE}/api/v1/admin/settings", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert isinstance(data["data"], list)
        assert len(data["data"]) > 0

        # Secrets should be masked
        for setting in data["data"]:
            if setting["is_secret"] and setting["value"]:
                assert setting["value"] == "••••••••"


@pytest.mark.asyncio
async def test_settings_filter_by_category():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as client:
        headers = await _login(client, "admin@cip.pk", "admin123")
        resp = await client.get(f"{BASE}/api/v1/admin/settings?category=smtp", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        for setting in data["data"]:
            assert setting["category"] == "smtp"


@pytest.mark.asyncio
async def test_settings_update():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as client:
        headers = await _login(client, "admin@cip.pk", "admin123")
        resp = await client.patch(
            f"{BASE}/api/v1/admin/settings",
            json={"trial_quota_per_service": "20"},
            headers=headers,
        )
        assert resp.status_code == 200
