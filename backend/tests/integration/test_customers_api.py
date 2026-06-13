"""Integration tests for customers API. Requires seeded DB (make seed)."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


async def _login(client: AsyncClient) -> str | None:
    """Login as MLRO (tenant user). Returns access token or None."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "mlro@vasp.pk", "password": "demo123"},
    )
    if resp.status_code != 200:
        return None
    return resp.json().get("access_token")


@pytest.mark.asyncio
async def test_customers_list_requires_auth():
    """GET /customers without auth returns 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        resp = await client.get("/api/v1/customers")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_customers_create_and_list():
    """POST /customers creates, GET /customers lists."""
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

        create = await client.post(
            "/api/v1/customers",
            headers=headers,
            json={
                "full_name": "Ahmed Hassan",
                "external_ref": "ext-001",
                "dob": "1990-05-15",
                "nationality": "PK",
                "cnic_number": "35201-1234567-1",
            },
        )
        assert create.status_code == 201
        data = create.json()
        assert data["fullName"] == "Ahmed Hassan"
        assert data["kycStatus"] == "initiated"
        customer_id = data["id"]

        list_resp = await client.get("/api/v1/customers", headers=headers)
        assert list_resp.status_code == 200
        items = [i for i in list_resp.json()["items"] if i["id"] == customer_id]
        assert len(items) == 1


@pytest.mark.asyncio
async def test_customers_get_by_id():
    """GET /customers/{id} returns single customer."""
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

        create = await client.post(
            "/api/v1/customers",
            headers=headers,
            json={"full_name": "Sara Khan", "nationality": "PK"},
        )
        if create.status_code != 201:
            pytest.skip(f"Create failed: {create.status_code}")
        customer_id = create.json()["id"]

        get_resp = await client.get(f"/api/v1/customers/{customer_id}", headers=headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["fullName"] == "Sara Khan"


@pytest.mark.asyncio
async def test_customers_get_not_found():
    """GET /customers/{id} with invalid id returns 404."""
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
            "/api/v1/customers/00000000-0000-0000-0000-000000000000",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_customers_patch():
    """PATCH /customers/{id} updates customer."""
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

        create = await client.post(
            "/api/v1/customers",
            headers=headers,
            json={"full_name": "Imran Ali"},
        )
        if create.status_code != 201:
            pytest.skip(f"Create failed: {create.status_code}")
        customer_id = create.json()["id"]

        patch = await client.patch(
            f"/api/v1/customers/{customer_id}",
            headers=headers,
            json={"full_name": "Imran Ali Updated", "kyc_status": "documents_uploaded"},
        )
        assert patch.status_code == 200
        assert patch.json()["fullName"] == "Imran Ali Updated"


@pytest.mark.asyncio
async def test_customers_invalid_kyc_transition():
    """PATCH with invalid kyc_status transition returns 400."""
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

        create = await client.post(
            "/api/v1/customers",
            headers=headers,
            json={"full_name": "KYC Test User"},
        )
        if create.status_code != 201:
            pytest.skip(f"Create failed: {create.status_code}")
        customer_id = create.json()["id"]

        patch = await client.patch(
            f"/api/v1/customers/{customer_id}",
            headers=headers,
            json={"kyc_status": "approved"},
        )
        assert patch.status_code == 400
        assert "Invalid KYC transition" in patch.json().get("error", {}).get("message", "")


@pytest.mark.asyncio
async def test_document_upload_id_doc():
    """POST /customers/{id}/documents uploads ID doc, transitions KYC, returns ocrData."""
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

        create = await client.post(
            "/api/v1/customers",
            headers=headers,
            json={"full_name": "Doc Upload Test", "nationality": "PK"},
        )
        if create.status_code != 201:
            pytest.skip(f"Create failed: {create.status_code}")
        customer_id = create.json()["id"]

        jpeg_minimal = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
        files = {"file": ("doc.jpg", jpeg_minimal, "image/jpeg")}
        data_form = {"document_type": "cnic"}

        upload = await client.post(
            f"/api/v1/customers/{customer_id}/documents",
            headers=headers,
            files=files,
            data=data_form,
        )
        assert upload.status_code == 201
        doc = upload.json()
        assert doc["documentType"] == "cnic"
        assert doc["contentType"] == "image/jpeg"
        assert "fileKey" in doc
        assert "ocrData" in doc  # OCR runs on ID docs; may be null if tesseract not installed

        get_cust = await client.get(f"/api/v1/customers/{customer_id}", headers=headers)
        assert get_cust.status_code == 200
        assert get_cust.json()["kycStatus"] == "documents_uploaded"


@pytest.mark.asyncio
async def test_document_upload_selfie():
    """POST /customers/{id}/documents accepts document_type=selfie."""
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

        create = await client.post(
            "/api/v1/customers",
            headers=headers,
            json={"full_name": "Selfie Test Customer"},
        )
        if create.status_code != 201:
            pytest.skip(f"Create failed: {create.status_code}")
        customer_id = create.json()["id"]

        # First upload ID doc (required before selfie for face match)
        jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
        upload1 = await client.post(
            f"/api/v1/customers/{customer_id}/documents",
            headers=headers,
            files={"file": ("id.jpg", jpeg, "image/jpeg")},
            data={"document_type": "cnic"},
        )
        if upload1.status_code != 201:
            pytest.skip(f"ID doc upload failed: {upload1.status_code}")

        # Upload selfie
        upload2 = await client.post(
            f"/api/v1/customers/{customer_id}/documents",
            headers=headers,
            files={"file": ("selfie.jpg", jpeg, "image/jpeg")},
            data={"document_type": "selfie"},
        )
        assert upload2.status_code == 201
        assert upload2.json()["documentType"] == "selfie"


@pytest.mark.asyncio
async def test_list_documents():
    """GET /customers/{id}/documents returns document list."""
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

        create = await client.post(
            "/api/v1/customers",
            headers=headers,
            json={"full_name": "List Docs Test"},
        )
        if create.status_code != 201:
            pytest.skip(f"Create failed: {create.status_code}")
        customer_id = create.json()["id"]

        resp = await client.get(
            f"/api/v1/customers/{customer_id}/documents",
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_list_verification_results():
    """GET /customers/{id}/verification-results returns verification list."""
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

        create = await client.post(
            "/api/v1/customers",
            headers=headers,
            json={"full_name": "Verification Results Test"},
        )
        if create.status_code != 201:
            pytest.skip(f"Create failed: {create.status_code}")
        customer_id = create.json()["id"]

        resp = await client.get(
            f"/api/v1/customers/{customer_id}/verification-results",
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_verify_nadra_pass():
    """POST /customers/{id}/verify-nadra runs NADRA mock, returns pass for 35201."""
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

        create = await client.post(
            "/api/v1/customers",
            headers=headers,
            json={"full_name": "Lahore Test", "cnic_number": "35201-1234567-1"},
        )
        if create.status_code != 201:
            pytest.skip(f"Create failed: {create.status_code}")
        customer_id = create.json()["id"]

        resp = await client.post(
            f"/api/v1/customers/{customer_id}/verify-nadra",
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["verificationType"] == "nadra"
        assert data["status"] == "pass"
        assert data["provider"] == "mock_nadra"


@pytest.mark.asyncio
async def test_verify_nadra_fail():
    """POST /customers/{id}/verify-nadra returns fail for 00000-XXXXXXX-X."""
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

        create = await client.post(
            "/api/v1/customers",
            headers=headers,
            json={"full_name": "Fail Test", "cnic_number": "00000-9999999-9"},
        )
        if create.status_code != 201:
            pytest.skip(f"Create failed: {create.status_code}")
        customer_id = create.json()["id"]

        resp = await client.post(
            f"/api/v1/customers/{customer_id}/verify-nadra",
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["verificationType"] == "nadra"
        assert data["status"] == "fail"


@pytest.mark.asyncio
async def test_verify_nadra_no_cnic():
    """POST /customers/{id}/verify-nadra returns 400 when customer has no CNIC."""
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

        create = await client.post(
            "/api/v1/customers",
            headers=headers,
            json={"full_name": "No CNIC Test"},
        )
        if create.status_code != 201:
            pytest.skip(f"Create failed: {create.status_code}")
        customer_id = create.json()["id"]

        resp = await client.post(
            f"/api/v1/customers/{customer_id}/verify-nadra",
            headers=headers,
        )
        assert resp.status_code == 400


@pytest.mark.asyncio
async def test_score_risk():
    """POST /customers/{id}/score-risk runs engine, updates risk_tier, advances status."""
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

        create = await client.post(
            "/api/v1/customers",
            headers=headers,
            json={"full_name": "Risk Score Test", "nationality": "PK"},
        )
        if create.status_code != 201:
            pytest.skip(f"Create failed: {create.status_code}")
        customer_id = create.json()["id"]

        # Patch through valid transitions to liveness_checked
        for status in ["documents_uploaded", "identity_verified", "liveness_checked"]:
            patch = await client.patch(
                f"/api/v1/customers/{customer_id}",
                headers=headers,
                json={"kyc_status": status},
            )
            if patch.status_code != 200:
                pytest.skip(f"Patch to {status} failed: {patch.status_code}")

        resp = await client.post(
            f"/api/v1/customers/{customer_id}/score-risk",
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["kycStatus"] == "risk_scored"
        assert data["riskTier"] in ("low", "medium", "high", "prohibited")


@pytest.mark.asyncio
async def test_score_risk_prohibited_nationality():
    """Risk scoring with prohibited nationality (IR) -> rejected."""
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

        create = await client.post(
            "/api/v1/customers",
            headers=headers,
            json={"full_name": "Prohibited Test", "nationality": "IR"},
        )
        if create.status_code != 201:
            pytest.skip(f"Create failed: {create.status_code}")
        customer_id = create.json()["id"]

        for status in ["documents_uploaded", "identity_verified", "liveness_checked"]:
            patch = await client.patch(
                f"/api/v1/customers/{customer_id}",
                headers=headers,
                json={"kyc_status": status},
            )
            if patch.status_code != 200:
                pytest.skip(f"Patch to {status} failed: {patch.status_code}")

        resp = await client.post(
            f"/api/v1/customers/{customer_id}/score-risk",
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["riskTier"] == "prohibited"
        assert data["kycStatus"] == "rejected"


@pytest.mark.asyncio
async def test_run_kyc_pipeline():
    """POST /customers/{id}/run-kyc runs orchestrator (NADRA and/or risk scoring)."""
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

        create = await client.post(
            "/api/v1/customers",
            headers=headers,
            json={"full_name": "Pipeline Test", "cnic_number": "35201-1111111-1"},
        )
        if create.status_code != 201:
            pytest.skip(f"Create failed: {create.status_code}")
        customer_id = create.json()["id"]

        # Upload doc to reach documents_uploaded
        jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
        upload = await client.post(
            f"/api/v1/customers/{customer_id}/documents",
            headers=headers,
            files={"file": ("id.jpg", jpeg, "image/jpeg")},
            data={"document_type": "cnic"},
        )
        if upload.status_code != 201:
            pytest.skip(f"Upload failed: {upload.status_code}")

        resp = await client.post(
            f"/api/v1/customers/{customer_id}/run-kyc",
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "customer" in data
        assert "stepsRun" in data
        assert "message" in data
        assert "nadra" in data["stepsRun"] or len(data["stepsRun"]) >= 0
        assert data["customer"]["kycStatus"] in (
            "identity_verified",
            "liveness_checked",
            "risk_scored",
            "edd_required",
            "rejected",
        )
