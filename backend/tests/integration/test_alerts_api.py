"""Integration tests for alerts API."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


async def _login(client: AsyncClient) -> str | None:
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": "mlro@vasp.pk", "password": "demo123"},
    )
    return r.json()["access_token"] if r.status_code == 200 else None


@pytest.mark.asyncio
async def test_alerts_list_requires_auth():
    """GET /alerts without auth returns 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        resp = await client.get("/api/v1/alerts")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_alerts_list_success():
    """GET /alerts with auth returns items and total."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        token = await _login(client)
        if not token:
            pytest.skip("Run make seed")
        resp = await client.get(
            "/api/v1/alerts",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)
    assert isinstance(data["total"], int)


@pytest.mark.asyncio
async def test_alerts_get_not_found():
    """GET /alerts/{id} with nonexistent ID returns 404."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        token = await _login(client)
        if not token:
            pytest.skip("Run make seed")
        resp = await client.get(
            "/api/v1/alerts/00000000-0000-0000-0000-000000000001",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_alerts_patch_not_found():
    """PATCH /alerts/{id} with nonexistent ID returns 404."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        token = await _login(client)
        if not token:
            pytest.skip("Run make seed")
        resp = await client.patch(
            "/api/v1/alerts/00000000-0000-0000-0000-000000000001",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "in_review"},
        )
    assert resp.status_code == 404
