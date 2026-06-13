"""Liveness adapter (Phase 4.6). DEFERRED — requires mobile capture flow."""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class LivenessResult:
    """Placeholder for liveness check result."""

    passed: bool
    reason: str


class LivenessAdapter:
    """
    Liveness detection adapter. DEFERRED.

    Real liveness (blink, turn head, etc.) requires mobile capture flow.
    Desktop-only app cannot reliably perform liveness checks.
    This adapter always returns not-passed with a reason.
    """

    def check(self, video_bytes: bytes | None = None) -> LivenessResult:
        """Placeholder: liveness not implemented."""
        return LivenessResult(
            passed=False,
            reason="Liveness deferred: requires mobile capture flow. Desktop-only app.",
        )
