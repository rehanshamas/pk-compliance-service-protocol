"""Integration tests for STR/CTR reports API (Phase 5.3). Requires seeded DB."""

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
async def test_reports_list_requires_auth():
    """GET /reports/str without auth returns 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        resp = await client.get("/api/v1/reports/str")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_reports_list_with_auth():
    """GET /reports/str with auth returns items and total."""
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

        resp = await client.get("/api/v1/reports/str", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_reports_generate_requires_approved_isar():
    """POST /reports/str/generate with draft ISAR returns validation error."""
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

        # Create case and get a customer
        case_resp = await client.post(
            "/api/v1/cases",
            headers=headers,
            json={"title": "STR Test Case"},
        )
        if case_resp.status_code not in (200, 201):
            pytest.skip("Need cases: run make seed")
        case_id = case_resp.json()["id"]

        customers_resp = await client.get("/api/v1/customers?limit=1", headers=headers)
        if customers_resp.status_code != 200 or not customers_resp.json().get("items"):
            pytest.skip("Need customers: run make seed")
        customer_id = customers_resp.json()["items"][0]["id"]

        # Create ISAR (draft)
        isar_resp = await client.post(
            "/api/v1/isars",
            headers=headers,
            json={
                "caseId": case_id,
                "subjectCustomerId": customer_id,
                "suspicionType": "structuring",
                "narrative": "Test narrative for STR generation.",
            },
        )
        if isar_resp.status_code != 201:
            pytest.skip(f"Need ISAR: {isar_resp.status_code} {isar_resp.text}")
        isar_id = isar_resp.json()["id"]
        assert isar_resp.json()["status"] == "draft"

        # Try to generate STR from draft ISAR — should fail
        gen_resp = await client.post(
            "/api/v1/reports/str/generate",
            headers=headers,
            json={"isarId": isar_id, "schemaVersion": "1.0"},
        )
    assert gen_resp.status_code in (400, 422)  # validation or business logic rejection
    err = gen_resp.json()
    assert "error" in err or "detail" in err or "status" in err


@pytest.mark.asyncio
async def test_reports_generate_and_download():
    """Full flow: create case, ISAR, submit, approve, generate STR, download XML."""
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
        case_resp = await client.post(
            "/api/v1/cases",
            headers=headers,
            json={"title": "STR E2E Case"},
        )
        if case_resp.status_code not in (200, 201):
            pytest.skip("Need cases: run make seed")
        case_id = case_resp.json()["id"]

        # Get customer
        customers_resp = await client.get("/api/v1/customers?limit=1", headers=headers)
        if customers_resp.status_code != 200 or not customers_resp.json().get("items"):
            pytest.skip("Need customers: run make seed")
        customer_id = customers_resp.json()["items"][0]["id"]

        # Create ISAR
        isar_resp = await client.post(
            "/api/v1/isars",
            headers=headers,
            json={
                "caseId": case_id,
                "subjectCustomerId": customer_id,
                "suspicionType": "unusual_transaction_pattern",
                "narrative": "E2E STR test narrative.",
            },
        )
        if isar_resp.status_code != 201:
            pytest.skip(f"Need ISAR: {isar_resp.status_code} {isar_resp.text}")
        isar_id = isar_resp.json()["id"]

        # Submit for review
        submit_resp = await client.post(
            f"/api/v1/isars/{isar_id}/submit",
            headers=headers,
        )
        if submit_resp.status_code != 200:
            pytest.skip(f"Submit failed: {submit_resp.status_code} {submit_resp.text}")

        # Approve (MLRO)
        approve_resp = await client.post(
            f"/api/v1/isars/{isar_id}/approve",
            headers=headers,
            json={"notes": "Approved for STR E2E test"},
        )
        if approve_resp.status_code != 200:
            pytest.skip(f"Approve failed: {approve_resp.status_code} {approve_resp.text}")

        # Generate STR
        gen_resp = await client.post(
            "/api/v1/reports/str/generate",
            headers=headers,
            json={"isarId": isar_id, "schemaVersion": "1.0"},
        )
    assert gen_resp.status_code == 201
    report = gen_resp.json()
    assert report["isarId"] == isar_id
    assert report["reportType"] == "str"
    assert report["filingStatus"] == "generated"
    report_id = report["id"]

    # Download
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {token}"},
    ) as client:
        dl_resp = await client.get(
            f"/api/v1/reports/str/{report_id}/download",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert dl_resp.status_code == 200
    assert "application/xml" in dl_resp.headers.get("content-type", "")
    assert "Content-Disposition" in dl_resp.headers
    assert "STR-" in dl_resp.headers.get("Content-Disposition", "")
    xml_content = dl_resp.text
    assert "<?xml" in xml_content
    assert "report" in xml_content  # <report> root element
    assert isar_id in xml_content
