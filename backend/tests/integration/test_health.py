"""Integration tests for health endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health():
    """GET /health returns ok."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_health_ready():
    """GET /health/ready checks DB + Redis."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health/ready")
    # May be 200 or 503 depending on DB/Redis availability
    assert resp.status_code in (200, 503)
    data = resp.json()
    assert "status" in data
    if resp.status_code == 503:
        assert "detail" in data
