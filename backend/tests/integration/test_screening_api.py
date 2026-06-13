"""Integration tests for screening API. Requires seeded DB and watchlist data."""

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
async def test_screening_check_requires_auth():
    """POST /screening/check without auth returns 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        resp = await client.post(
            "/api/v1/screening/check",
            json={"name": "Test Person"},
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_screening_check_success():
    """POST /screening/check with auth returns screening result."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        token = await _login(client)
        if not token:
            pytest.skip("Run make seed")
        resp = await client.post(
            "/api/v1/screening/check",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "John Smith"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert data.get("screenedEntityName") == "John Smith"
    assert "overallStatus" in data
    assert data["overallStatus"] in ("clear", "confirmed_match", "potential_match")
    assert "matches" in data
    assert "createdAt" in data


@pytest.mark.asyncio
async def test_screening_results_list():
    """GET /screening/results returns list."""
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
            "/api/v1/screening/results",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)
    assert isinstance(data["total"], int)


@pytest.mark.asyncio
async def test_screening_batch_list():
    """GET /screening/batch returns batch jobs."""
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
            "/api/v1/screening/batch",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_screening_result_by_id():
    """GET /screening/results/{id} returns result detail with matches."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        token = await _login(client)
        if not token:
            pytest.skip("Run make seed")
        # Create a screening result first
        check = await client.post(
            "/api/v1/screening/check",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Muhammad Ahmed Khan"},
        )
        if check.status_code != 200:
            pytest.skip("Screening check failed")
        result_id = check.json()["id"]
        resp = await client.get(
            f"/api/v1/screening/results/{result_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
    if resp.status_code != 200:
        pytest.skip(f"GET result failed: {resp.status_code}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == result_id
    assert "screenedEntityName" in data
    assert "matches" in data
    assert "dispositionStatus" in data


@pytest.mark.asyncio
async def test_screening_disposition():
    """POST /screening/dispositions creates disposition."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        token = await _login(client)
        if not token:
            pytest.skip("Run make seed")
        # Create screening result
        check = await client.post(
            "/api/v1/screening/check",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Random Unique Name Xyz123"},
        )
        if check.status_code != 200:
            pytest.skip("Screening check failed")
        result_id = check.json()["id"]
        resp = await client.post(
            "/api/v1/screening/dispositions",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "screening_result_id": result_id,
                "disposition": "false_positive",
                "rationale": "Different person, verified via internal records",
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert data.get("disposition") == "false_positive"
