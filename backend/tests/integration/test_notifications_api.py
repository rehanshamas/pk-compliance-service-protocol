"""Integration tests for notifications API. Phase 5.7."""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def auth_headers(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "mlro@vasp.pk", "password": "demo123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    token = data["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def test_notifications_list_requires_auth():
    """GET /notifications without auth returns 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/notifications")
        assert resp.status_code == 401


async def test_notifications_list_success(client: AsyncClient, auth_headers):
    """GET /notifications with auth returns items, total, unreadCount."""
    resp = await client.get(
        "/api/v1/notifications",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "unreadCount" in data
    assert isinstance(data["items"], list)
    assert isinstance(data["total"], int)
    assert isinstance(data["unreadCount"], int)


async def test_notifications_mark_read(client: AsyncClient, auth_headers):
    """POST /notifications/mark-read marks all as read."""
    resp = await client.post(
        "/api/v1/notifications/mark-read",
        headers=auth_headers,
        json={},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "markedCount" in data
    assert isinstance(data["markedCount"], int)
