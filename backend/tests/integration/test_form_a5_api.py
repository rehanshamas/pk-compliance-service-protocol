"""Integration tests for Form A5 API (Phase 5.4). Requires seeded DB."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


async def _login(client: AsyncClient) -> str | None:
    """Login and return Bearer token or None."""
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": "mlro@vasp.pk", "password": "demo123"},
    )
    if r.status_code != 200:
        return None
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_form_a5_preview_requires_auth():
    """GET /reports/form-a5/preview without auth returns 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        resp = await client.get("/api/v1/reports/form-a5/preview")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_form_a5_download_requires_auth():
    """GET /reports/form-a5/download without auth returns 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        resp = await client.get("/api/v1/reports/form-a5/download")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_form_a5_preview_with_auth():
    """GET /reports/form-a5/preview with auth returns register data."""
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

        resp = await client.get("/api/v1/reports/form-a5/preview", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "tenantName" in data
    assert "tenantSlug" in data
    assert "outsourcingRegister" in data
    assert isinstance(data["outsourcingRegister"], list)
    assert len(data["outsourcingRegister"]) >= 1
    entry = data["outsourcingRegister"][0]
    assert "provider" in entry
    assert "functions" in entry
    assert "status" in entry


@pytest.mark.asyncio
async def test_form_a5_download_with_auth():
    """GET /reports/form-a5/download returns HTML document."""
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

        resp = await client.get("/api/v1/reports/form-a5/download", headers=headers)
    assert resp.status_code == 200
    assert "text/html" in resp.headers.get("content-type", "")
    assert "Content-Disposition" in resp.headers
    assert "Form-A5-" in resp.headers.get("Content-Disposition", "")
    html = resp.text
    assert "Form A5" in html
    assert "Outsourcing Register" in html
    assert "<table" in html
