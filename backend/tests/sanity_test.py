#!/usr/bin/env python3
"""CIP Sanity Test — 14 checks against live backend (http://localhost:8000)."""

import sys
import time
import httpx

BASE = "http://localhost:8000"
RUN_ID = str(int(time.time()))  # unique per run
PASS = 0
FAIL = 0
RESULTS = []


def check(name: str, ok: bool, detail: str = ""):
    global PASS, FAIL
    status = "PASS" if ok else "FAIL"
    if ok:
        PASS += 1
    else:
        FAIL += 1
    RESULTS.append((name, status, detail))
    mark = "\033[92m✓\033[0m" if ok else "\033[91m✗\033[0m"
    print(f"  {mark} {name}" + (f"  ({detail})" if detail and not ok else ""))


def main():
    print("\n=== CIP Sanity Test ===\n")

    # 1. Health
    r = httpx.get(f"{BASE}/health")
    check("Health", r.status_code == 200 and r.json().get("status") == "ok")

    # 2. Login as MLRO
    r = httpx.post(f"{BASE}/api/v1/auth/login", json={"email": "mlro@vasp.pk", "password": "demo123"})
    check("Login MLRO", r.status_code == 200 and "access_token" in r.json())
    if r.status_code != 200:
        print("Cannot continue without auth. Exiting.")
        sys.exit(1)
    token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    # 3. List customers
    r = httpx.get(f"{BASE}/api/v1/customers", headers=h)
    check("List customers", r.status_code == 200, f"status={r.status_code}")

    # 4. Create customer
    r = httpx.post(f"{BASE}/api/v1/customers", headers=h, json={
        "full_name": "Sanity Test User",
        "external_ref": f"sanity-{RUN_ID}",
        "cnic_number": "35201-1234567-1",
        "phone": "+923001234567",
    })
    created = r.status_code == 201
    check("Create customer", created, f"status={r.status_code}")
    customer_id = r.json().get("id") if created else None

    # 5. Get customer by ID
    if customer_id:
        r = httpx.get(f"{BASE}/api/v1/customers/{customer_id}", headers=h)
        check("Get customer by ID", r.status_code == 200 and r.json().get("fullName") == "Sanity Test User",
              f"status={r.status_code}")
    else:
        check("Get customer by ID", False, "skipped — no customer_id")

    # 6. Get customer by external ref (camelCase response)
    r = httpx.get(f"{BASE}/api/v1/customers/by-ref/sanity-{RUN_ID}", headers=h)
    check("Customer by-ref",
          r.status_code == 200 and r.json().get("fullName") == "Sanity Test User",
          f"status={r.status_code}, keys={list(r.json().keys())[:5] if r.status_code == 200 else 'N/A'}")

    # 7. Create KYC session (upgrade_from_basic)
    r = httpx.post(f"{BASE}/api/v1/kyc-sessions", headers=h, json={
        "external_ref": f"sanity-{RUN_ID}",
        "customer_name": "Sanity Test User",
        "customer_cnic": "35201-1234567-1",
        "verification_level": "advanced",
        "upgrade_from_basic": True,
    })
    session_created = r.status_code == 201
    check("Create KYC session", session_created, f"status={r.status_code}")
    session_id = r.json().get("session_id") if session_created else None

    # 8. Check KYC session status
    if session_id:
        r = httpx.get(f"{BASE}/api/v1/kyc-sessions/{session_id}", headers=h)
        ok = r.status_code == 200 and r.json().get("status") in ("pending", "in_progress")
        # For upgrade_from_basic: if customer has NO completed basic KYC, step stays at 'upload' (correct behavior)
        step = r.json().get("current_step", "") if r.status_code == 200 else ""
        check("KYC session status",
              ok,
              f"status={r.json().get('status')}, step={step}")
    else:
        check("KYC session status", False, "skipped — no session_id")

    # 9. Screening check (overallStatus in camelCase)
    r = httpx.post(f"{BASE}/api/v1/screening/check", headers=h, json={
        "name": "John Doe",
    })
    check("Screening check",
          r.status_code == 200 and "overallStatus" in r.json(),
          f"status={r.status_code}, keys={list(r.json().keys())[:5] if r.status_code == 200 else r.text[:100]}")

    # 10. List screening results
    r = httpx.get(f"{BASE}/api/v1/screening/results", headers=h)
    check("List screening results", r.status_code == 200, f"status={r.status_code}")

    # 11. Wallet register (analytics router mounted at /api/v1/wallets)
    r = httpx.post(f"{BASE}/api/v1/wallets/register", headers=h, json={
        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD78",
        "chain": "ethereum",
        "label": "Sanity test wallet",
    })
    check("Wallet register",
          r.status_code in (200, 201),
          f"status={r.status_code}, body={r.text[:120] if r.status_code >= 400 else 'ok'}")

    # 12. Wallet score (analytics router mounted at /api/v1/wallets)
    r = httpx.post(f"{BASE}/api/v1/wallets/score", headers=h, json={
        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD78",
        "chain": "ethereum",
    })
    check("Wallet score",
          r.status_code == 200,
          f"status={r.status_code}, body={r.text[:120] if r.status_code >= 400 else 'ok'}")

    # 13. List alerts
    r = httpx.get(f"{BASE}/api/v1/alerts", headers=h)
    check("List alerts", r.status_code == 200, f"status={r.status_code}")

    # 14. Notifications
    r = httpx.get(f"{BASE}/api/v1/notifications", headers=h)
    check("List notifications", r.status_code == 200, f"status={r.status_code}")

    # Summary
    print(f"\n{'='*40}")
    print(f"  {PASS}/{PASS+FAIL} passed", end="")
    if FAIL:
        print(f"  |  {FAIL} failed")
    else:
        print("  — ALL CLEAR")
    print(f"{'='*40}\n")

    sys.exit(0 if FAIL == 0 else 1)


if __name__ == "__main__":
    main()
