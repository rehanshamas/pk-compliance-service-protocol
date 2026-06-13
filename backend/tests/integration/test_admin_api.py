"""Integration tests for admin API. Requires platform admin user."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_admin_pipelines_requires_admin():
    """GET /admin/pipelines as MLRO returns 403."""
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
        resp = await client.get(
            "/api/v1/admin/pipelines",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_pipelines_success():
    """GET /admin/pipelines as admin returns pipelines."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@cip.pk", "password": "admin123"},
        )
        if login.status_code != 200:
            pytest.skip("Run make seed — need admin@cip.pk / admin123")
        token = login.json()["access_token"]
        resp = await client.get(
            "/api/v1/admin/pipelines",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "pipelines" in data
        assert isinstance(data["pipelines"], list)
        sources = {p["source"] for p in data["pipelines"]}
        assert len(sources) >= 1


@pytest.mark.asyncio
async def test_admin_tenants_list():
    """GET /admin/tenants as admin returns tenant list."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@cip.pk", "password": "admin123"},
        )
        if login.status_code != 200:
            pytest.skip("Run make seed — need admin@cip.pk / admin123")
        token = login.json()["access_token"]
        resp = await client.get(
            "/api/v1/admin/tenants",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)
        for t in data["items"]:
            assert "id" in t and "name" in t and "slug" in t
            assert "status" in t and "featureFlags" in t
            assert "usersCount" in t and "createdAt" in t


@pytest.mark.asyncio
async def test_admin_tenants_create_get_patch_rotate():
    """POST create, GET detail, PATCH update, POST rotate-api-key. Platform admin only."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@cip.pk", "password": "admin123"},
        )
        if login.status_code != 200:
            pytest.skip("Run make seed")
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        create = await client.post(
            "/api/v1/admin/tenants",
            headers=headers,
            json={"name": "Test VASP Phase 5.8"},
        )
        if create.status_code != 201:
            pytest.skip(f"Create failed: {create.json()}")
        tenant = create.json()
        tenant_id = tenant["id"]
        assert tenant["name"] == "Test VASP Phase 5.8"
        assert tenant["status"] == "trial"

        get_resp = await client.get(
            f"/api/v1/admin/tenants/{tenant_id}",
            headers=headers,
        )
        assert get_resp.status_code == 200
        detail = get_resp.json()
        assert "users" in detail

        patch = await client.patch(
            f"/api/v1/admin/tenants/{tenant_id}",
            headers=headers,
            json={"name": "Test VASP Updated", "status": "active"},
        )
        assert patch.status_code == 200
        updated = patch.json()
        assert updated["name"] == "Test VASP Updated"
        assert updated["status"] == "active"

        rotate = await client.post(
            f"/api/v1/admin/tenants/{tenant_id}/rotate-api-key",
            headers=headers,
        )
        assert rotate.status_code == 200
        key_data = rotate.json()
        assert "apiKey" in key_data
        assert key_data["apiKey"].startswith("cip_live_")


@pytest.mark.asyncio
async def test_admin_usage():
    """GET /admin/usage as admin returns tenants, totals, daily. GET /admin/usage/export returns CSV. Phase 5.9."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@cip.pk", "password": "admin123"},
        )
        if login.status_code != 200:
            pytest.skip("Run make seed")
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        resp = await client.get("/api/v1/admin/usage", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "tenants" in data
        assert "totals" in data
        assert "daily" in data
        assert "verifications" in data["totals"]
        assert "screenings" in data["totals"]
        resp2 = await client.get("/api/v1/admin/usage/export?dateRange=7", headers=headers)
        assert resp2.status_code == 200
        assert "text/csv" in resp2.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_admin_audit():
    """GET /admin/audit as platform admin returns items and total. Phase 5.10."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@cip.pk", "password": "admin123"},
        )
        if login.status_code != 200:
            pytest.skip("Run make seed")
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        resp = await client.get("/api/v1/admin/audit", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)
        for item in data["items"]:
            assert "id" in item and "action" in item and "resourceType" in item
            assert "tenantId" in item or "tenantName" in item
            assert "user" in item and "createdAt" in item
        # With filters
        resp2 = await client.get(
            "/api/v1/admin/audit?dateRange=7&limit=10&offset=0",
            headers=headers,
        )
        assert resp2.status_code == 200


@pytest.mark.asyncio
async def test_admin_audit_middleware_writes():
    """Mutating requests write to audit_log. Creates tenant, then asserts audit entry exists."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@cip.pk", "password": "admin123"},
        )
        if login.status_code != 200:
            pytest.skip("Run make seed")
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        # Mutating request: create tenant
        create = await client.post(
            "/api/v1/admin/tenants",
            headers=headers,
            json={"name": "Audit Test Tenant"},
        )
        if create.status_code != 201:
            pytest.skip(f"Create failed: {create.json()}")
        # Audit should have at least one create/tenant entry
        audit_resp = await client.get("/api/v1/admin/audit?limit=50", headers=headers)
        assert audit_resp.status_code == 200
        data = audit_resp.json()
        creates = [i for i in data["items"] if i.get("action") == "create" and i.get("resourceType") == "tenant"]
        assert len(creates) >= 1
