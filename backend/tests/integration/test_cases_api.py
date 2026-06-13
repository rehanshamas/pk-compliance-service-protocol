"""Integration tests for cases API (Phase 5.1). Requires seeded DB."""

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
async def test_cases_list_requires_auth():
    """GET /cases without auth returns 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        resp = await client.get("/api/v1/cases")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_cases_create_and_list():
    """POST /cases creates case, GET /cases lists it."""
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

        # Create case
        create_resp = await client.post(
            "/api/v1/cases",
            headers=headers,
            json={"title": "Test Investigation Case"},
        )
        assert create_resp.status_code == 201 or create_resp.status_code == 200
        case = create_resp.json()
        assert "id" in case
        assert case["title"] == "Test Investigation Case"
        assert case["status"] == "open"
        assert case["linkedAlertsCount"] >= 0

        # List cases
        list_resp = await client.get("/api/v1/cases", headers=headers)
        assert list_resp.status_code == 200
        data = list_resp.json()
        assert "items" in data
        assert "total" in data
        ids = [c["id"] for c in data["items"]]
        assert case["id"] in ids


@pytest.mark.asyncio
async def test_cases_get_and_patch():
    """GET /cases/{id} and PATCH /cases/{id} work."""
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

        # Create
        create_resp = await client.post(
            "/api/v1/cases",
            headers=headers,
            json={"title": "Patch Test Case"},
        )
        assert create_resp.status_code in (200, 201)
        case_id = create_resp.json()["id"]

        # Get
        get_resp = await client.get(f"/api/v1/cases/{case_id}", headers=headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["title"] == "Patch Test Case"

        # Patch
        patch_resp = await client.patch(
            f"/api/v1/cases/{case_id}",
            headers=headers,
            json={"status": "investigating"},
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["status"] == "investigating"
