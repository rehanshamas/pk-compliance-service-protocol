"""
Phase 8.2: Load testing with Locust.

Baseline targets (per DEVELOPMENT_PLAN):
- Auth: 100 req/s
- Screening: 500 req/s
- Analytics (cached): 1000 req/s

Usage:
  make load-test                    # Headless, 60s run
  locust -f locustfile.py           # Web UI (backend must be on :8000)

Requires: backend running, make seed (for mlro@vasp.pk / demo123).
"""

import os
import random
from locust import HttpUser, task, between

# Test user from seed (make seed)
LOAD_TEST_EMAIL = os.environ.get("LOAD_TEST_EMAIL", "mlro@vasp.pk")
LOAD_TEST_PASSWORD = os.environ.get("LOAD_TEST_PASSWORD", "demo123")


class CipApiUser(HttpUser):
    """Simulates tenant user: auth, screening, analytics."""

    wait_time = between(0.1, 0.5)
    token: str | None = None

    def on_start(self):
        """Login once per user to get JWT."""
        resp = self.client.post(
            "/api/v1/auth/login",
            json={"email": LOAD_TEST_EMAIL, "password": LOAD_TEST_PASSWORD},
        )
        if resp.status_code == 200:
            self.token = resp.json().get("access_token")
        else:
            self.token = None

    def _headers(self):
        if not self.token:
            return {}
        return {"Authorization": f"Bearer {self.token}"}

    @task(weight=10)
    def auth_login(self):
        """Auth endpoint — target ~100 req/s."""
        self.client.post(
            "/api/v1/auth/login",
            json={"email": LOAD_TEST_EMAIL, "password": LOAD_TEST_PASSWORD},
        )

    @task(weight=50)
    def screening_check(self):
        """Screening check — target ~500 req/s."""
        if not self.token:
            return
        names = ["Ahmed Khan", "Muhammad Ali", "Sara Hassan", "Fatima Noor", "Usman Malik"]
        self.client.post(
            "/api/v1/screening/check",
            json={"entity_name": random.choice(names), "entity_type": "individual"},
            headers=self._headers(),
        )

    @task(weight=40)
    def analytics_wallets_list(self):
        """GET /wallets (cached reads) — target ~1000 req/s."""
        if not self.token:
            return
        self.client.get(
            "/api/v1/wallets?limit=25&offset=0",
            headers=self._headers(),
        )

    @task(weight=5)
    def health(self):
        """Health check — lightweight."""
        self.client.get("/health")
