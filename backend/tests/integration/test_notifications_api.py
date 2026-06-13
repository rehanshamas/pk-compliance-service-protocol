"""Integration tests for notifications API. Phase 5.7."""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


async def _login(client):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "mlro@vasp.pk", "password": "demo123"},
    )
    if resp.status_code != 200:
        return None
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_notifications_list_requires_auth():
    """GET /notifications without auth returns 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/notifications")
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_notifications_list_success():
    """GET /notifications with auth returns items, total, unreadCount."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        token = await _login(client)
        if not token:
            pytest.skip("Run make seed")
        headers = {"Authorization": f"Bearer {token}"}
        resp = await client.get("/api/v1/notifications", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "unreadCount" in data
    assert isinstance(data["items"], list)
    assert isinstance(data["total"], int)
    assert isinstance(data["unreadCount"], int)


@pytest.mark.asyncio
async def test_notifications_mark_read():
    """POST /notifications/mark-read marks all as read."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        token = await _login(client)
        if not token:
            pytest.skip("Run make seed")
        headers = {"Authorization": f"Bearer {token}"}
        resp = await client.post(
            "/api/v1/notifications/mark-read",
            headers=headers,
            json={},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "markedCount" in data
    assert isinstance(data["markedCount"], int)
