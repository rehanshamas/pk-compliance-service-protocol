"""NADRA Verisys adapter (Phase 4.7, 7). Abstract interface + Mock + Sandbox. Phase 7 mock approach."""

import asyncio
import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

# Pakistani CNIC format: 35201-1234567-1 (5 digits - 7 digits - 1 digit)
CNIC_PATTERN = re.compile(r"^\d{5}-\d{7}-\d$")

# Simulated error codes (inferred from Verisys; not from official NADRA spec)
ERROR_CNIC_NOT_FOUND = "CNIC_NOT_FOUND"
ERROR_CNIC_EXPIRED = "CNIC_EXPIRED"
ERROR_CNIC_BLOCKED = "CNIC_BLOCKED"
ERROR_RATE_LIMIT = "RATE_LIMIT"
ERROR_TIMEOUT = "TIMEOUT"


@dataclass
class NadraVerifyResult:
    """Result of NADRA Verisys verification. citizenData inferred from Verisys docs."""

    verified: bool
    cnic: str
    city: str | None  # Lahore, Karachi, or None for fail
    raw_response: dict = field(default_factory=dict)
    error_code: str | None = None  # When verified=False
    citizen_data: dict | None = None  # When verified=True: name, father_name, gender, present_address, dob


def _normalize_cnic(cnic: str) -> str:
    """Normalize CNIC to XXXXX-XXXXXXX-X format."""
    cleaned = re.sub(r"\D", "", cnic)
    if len(cleaned) == 13:
        return f"{cleaned[:5]}-{cleaned[5:12]}-{cleaned[12]}"
    return cnic


def _build_citizen_data(cnic: str, name: str, city: str | None, dob: str | None) -> dict[str, Any]:
    """Build citizenData block (inferred from Verisys response shape)."""
    data: dict[str, Any] = {
        "cnic": cnic,
        "fullName": name,
        "fatherName": "Father of " + name.split()[0] if name else None,
        "gender": "M",  # Mock default
        "dateOfBirth": dob,
        "presentAddress": city or "Pakistan",
    }
    return data


class NadraAdapter(ABC):
    """Abstract NADRA Verisys adapter. Implement mock, sandbox, or real."""

    @property
    def provider_name(self) -> str:
        """Provider identifier for audit/metadata (e.g. mock_nadra, sandbox_nadra)."""
        return "nadra"

    @abstractmethod
    async def verify_cnic(
        self,
        cnic: str,
        name: str,
        dob: str | None = None,
    ) -> NadraVerifyResult:
        """Verify CNIC against NADRA. Returns pass/fail and metadata."""
        ...


class MockNadraAdapter(NadraAdapter):
    """
    Enhanced mock NADRA Verisys adapter. Phase 7.

    CNIC prefix patterns (first 5 digits):
    - 00000 → FAIL (CNIC_NOT_FOUND)
    - 11111 → FAIL (RATE_LIMIT) — simulates rate limit
    - 22222 → FAIL (CNIC_BLOCKED)
    - 99999 → FAIL (CNIC_EXPIRED)
    - 35201 → PASS (Lahore), full citizenData
    - 42101 → PASS (Karachi), full citizenData
    - Others → PASS with simulated 200–500ms delay, basic citizenData
    """

    def __init__(self, simulate_latency: bool = True, latency_seconds: float = 0.2):
        self.simulate_latency = simulate_latency
        self.latency_seconds = latency_seconds

    async def verify_cnic(
        self,
        cnic: str,
        name: str,
        dob: str | None = None,
    ) -> NadraVerifyResult:
        """Mock verification based on CNIC prefix."""
        normalized = _normalize_cnic(cnic)

        # Fail cases with simulated error codes
        if normalized.startswith("00000-"):
            return NadraVerifyResult(
                verified=False,
                cnic=normalized,
                city=None,
                error_code=ERROR_CNIC_NOT_FOUND,
                raw_response={
                    "cnic": normalized,
                    "status": "fail",
                    "errorCode": ERROR_CNIC_NOT_FOUND,
                    "reason": "CNIC not found or invalid",
                    "mock": True,
                },
            )
        if normalized.startswith("11111-"):
            return NadraVerifyResult(
                verified=False,
                cnic=normalized,
                city=None,
                error_code=ERROR_RATE_LIMIT,
                raw_response={
                    "cnic": normalized,
                    "status": "fail",
                    "errorCode": ERROR_RATE_LIMIT,
                    "reason": "Rate limit exceeded. Try again later.",
                    "mock": True,
                },
            )
        if normalized.startswith("22222-"):
            return NadraVerifyResult(
                verified=False,
                cnic=normalized,
                city=None,
                error_code=ERROR_CNIC_BLOCKED,
                raw_response={
                    "cnic": normalized,
                    "status": "fail",
                    "errorCode": ERROR_CNIC_BLOCKED,
                    "reason": "CNIC blocked or suspended",
                    "mock": True,
                },
            )
        if normalized.startswith("99999-"):
            return NadraVerifyResult(
                verified=False,
                cnic=normalized,
                city=None,
                error_code=ERROR_CNIC_EXPIRED,
                raw_response={
                    "cnic": normalized,
                    "status": "fail",
                    "errorCode": ERROR_CNIC_EXPIRED,
                    "reason": "CNIC has expired",
                    "mock": True,
                },
            )

        # Pass cases
        city = None
        if normalized.startswith("35201-"):
            city = "Lahore"
        elif normalized.startswith("42101-"):
            city = "Karachi"

        citizen_data = _build_citizen_data(normalized, name, city, dob)
        raw = {
            "cnic": normalized,
            "status": "pass",
            "city": city,
            "citizenData": citizen_data,
            "mock": True,
        }

        if self.simulate_latency:
            await asyncio.sleep(self.latency_seconds)

        return NadraVerifyResult(
            verified=True,
            cnic=normalized,
            city=city,
            citizen_data=citizen_data,
            raw_response=raw,
        )


class SandboxNadraAdapter(NadraAdapter):
    """
    NADRA sandbox adapter. Phase 7. Mock-backed until credentials.

    When NADRA_BASE_URL + credentials are set: would call real sandbox API.
    When not set: uses MockNadraAdapter logic for development.

    To activate real sandbox: set NADRA_ADAPTER=sandbox, NADRA_BASE_URL, NADRA_CLIENT_ID, NADRA_CLIENT_SECRET.
    """

    provider_name = "sandbox_nadra"

    def __init__(self):
        self._has_credentials = bool(
            getattr(settings, "nadra_base_url", "")
            and getattr(settings, "nadra_client_id", "")
            and getattr(settings, "nadra_client_secret", "")
        )
        self._mock = MockNadraAdapter(simulate_latency=True, latency_seconds=0.25)

    async def verify_cnic(
        self,
        cnic: str,
        name: str,
        dob: str | None = None,
    ) -> NadraVerifyResult:
        """Verify via sandbox API or mock fallback."""
        if not self._has_credentials:
            logger.debug("NADRA sandbox: no credentials, using mock fallback")
            return await self._mock.verify_cnic(cnic, name, dob)

        # BLOCKED: Real sandbox call — requires NADRA API contract (not publicly documented).
        # When credentials arrive: implement HTTP POST to NADRA_BASE_URL with auth headers.
        # For now, use mock to allow end-to-end testing of sandbox mode.
        logger.debug("NADRA sandbox: credentials present but real API not implemented, using mock")
        return await self._mock.verify_cnic(cnic, name, dob)


class RealNadraAdapter(NadraAdapter):
    """
    NADRA production adapter. Phase 7.

    Same as SandboxNadraAdapter but for production URL. Mock-backed until real integration.
    """

    provider_name = "real_nadra"

    def __init__(self):
        self._mock = MockNadraAdapter(simulate_latency=True, latency_seconds=0.3)

    async def verify_cnic(
        self,
        cnic: str,
        name: str,
        dob: str | None = None,
    ) -> NadraVerifyResult:
        """Verify via production API or mock fallback."""
        # BLOCKED: Real production — requires NADRA institutional credentials.
        logger.debug("NADRA real: production API not implemented, using mock")
        return await self._mock.verify_cnic(cnic, name, dob)


def get_nadra_adapter(mode: str | None = None) -> NadraAdapter:
    """Factory: return adapter by NADRA_ADAPTER env (mock, sandbox, real)."""
    m = (mode or getattr(settings, "nadra_adapter", "mock")).lower()
    if m in ("mock", "mocked", "test"):
        return MockNadraAdapter()
    if m == "sandbox":
        return SandboxNadraAdapter()
    if m == "real":
        return RealNadraAdapter()
    return MockNadraAdapter()
