"""Pytest fixtures for CIP backend tests."""

import os

# Set test environment before importing app
os.environ["ENVIRONMENT"] = "test"

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Skip integration tests if no DB (e.g. CI without Postgres)
# Set CIP_SKIP_INTEGRATION=1 to skip DB-requiring tests
SKIP_INTEGRATION = os.environ.get("CIP_SKIP_INTEGRATION", "").lower() in ("1", "true", "yes")


@pytest_asyncio.fixture(loop_scope="module", autouse=True)
async def _dispose_engine_per_module():
    """Dispose engine connections at end of each test module.

    asyncpg connections are bound to the event loop. With module-scoped loops,
    we dispose at the end of each module to prevent stale connections.
    """
    yield
    try:
        from app.database import engine
        await engine.dispose()
    except Exception:
        pass


@pytest_asyncio.fixture
async def async_client():
    """Async HTTP client for FastAPI app. Uses real DB — requires Postgres."""
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        yield client


@pytest.fixture
def auth_headers(async_client):
    """Sync fixture to get auth headers — not usable in async tests directly.
    Use login_and_headers fixture in async tests.
    """
    return None


@pytest_asyncio.fixture
async def login_and_headers(async_client):
    """
    Log in and return (client, headers_dict).
    Requires seeded user from make seed: mlro@vasp.pk / demo123
    """
    resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "mlro@vasp.pk", "password": "demo123"},
    )
    if resp.status_code != 200:
        pytest.skip(
            f"Login failed (status={resp.status_code}). "
            "Run make dev + make seed to create mlro@vasp.pk / demo123"
        )
    data = resp.json()
    token = data.get("access_token")
    if not token:
        pytest.skip("No access_token in login response")
    return async_client, {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def admin_headers(async_client):
    """Log in as platform admin. Requires seeded admin from make seed: admin@cip.pk / admin123"""
    resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@cip.pk", "password": "admin123"},
    )
    if resp.status_code != 200:
        pytest.skip(
            f"Admin login failed (status={resp.status_code}). "
            "Run make seed to create admin@cip.pk / admin123"
        )
    token = resp.json()["access_token"]
    return async_client, {"Authorization": f"Bearer {token}"}
