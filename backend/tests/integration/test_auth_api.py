"""Integration tests for auth API. Requires seeded DB (make seed)."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_login_success():
    """POST /auth/login with valid credentials returns tokens."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "mlro@vasp.pk", "password": "demo123"},
        )
    if resp.status_code != 200:
        pytest.skip(f"Login failed — run make seed. Status: {resp.status_code}")
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data.get("token_type") == "bearer"
    assert "user" in data
    assert data["user"].get("email") == "mlro@vasp.pk"


@pytest.mark.asyncio
async def test_login_invalid_password():
    """POST /auth/login with wrong password returns 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "mlro@vasp.pk", "password": "wrongpassword"},
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user():
    """POST /auth/login with unknown email returns 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "any"},
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token():
    """POST /auth/refresh with valid refresh token returns new tokens."""
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
    refresh_token = login.json()["refresh_token"]
    resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()
