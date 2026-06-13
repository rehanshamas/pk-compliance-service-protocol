"""Rule-based risk scoring engine (Phase 4.8)."""

from dataclasses import dataclass

from app.modules.identity.models import RiskTier

# Country ISO codes -> risk tier. Configurable per tenant in future.
PROHIBITED_COUNTRIES = frozenset({"IR", "KP", "SY"})  # Iran, North Korea, Syria
HIGH_RISK_COUNTRIES = frozenset({"AF", "MM", "ML", "BI", "CD"})  # Afghanistan, Myanmar, etc.
LOW_RISK_COUNTRIES = frozenset(
    {"US", "GB", "DE", "FR", "AE", "SA", "CA", "AU", "SG", "JP", "CH"}
)  # Major jurisdictions


@dataclass
class RiskScoreResult:
    """Result of risk scoring."""

    tier: RiskTier
    factors: list[str]
    raw_response: dict


def _normalize_country(code: str | None) -> str | None:
    """Normalize country code to 2-letter uppercase."""
    if not code or not code.strip():
        return None
    c = code.strip().upper()
    return c[:2] if len(c) >= 2 else None


def score_customer_risk(
    nationality: str | None,
    pep_match: bool = False,
) -> RiskScoreResult:
    """
    Rule-based risk scoring from nationality and PEP status.

    Rules:
    - Prohibited country -> prohibited
    - PEP true positive -> high (or prohibited if combined with high-risk)
    - High-risk country -> high
    - Low-risk country -> low
    - Pakistan (PK) or default -> medium
    """
    factors: list[str] = []
    country = _normalize_country(nationality)

    if country in PROHIBITED_COUNTRIES:
        factors.append("nationality_prohibited")
        return RiskScoreResult(
            tier=RiskTier.prohibited,
            factors=factors,
            raw_response={"nationality": country, "rule": "prohibited_country"},
        )

    if pep_match:
        factors.append("pep_true_positive")
        # PEP match alone -> high; with high-risk country -> prohibited
        if country in HIGH_RISK_COUNTRIES:
            factors.append("pep_plus_high_risk_country")
            return RiskScoreResult(
                tier=RiskTier.prohibited,
                factors=factors,
                raw_response={"nationality": country, "pep_match": True, "rule": "pep_high_risk"},
            )
        return RiskScoreResult(
            tier=RiskTier.high,
            factors=factors,
            raw_response={"nationality": country, "pep_match": True, "rule": "pep"},
        )

    if country in HIGH_RISK_COUNTRIES:
        factors.append("nationality_high_risk")
        return RiskScoreResult(
            tier=RiskTier.high,
            factors=factors,
            raw_response={"nationality": country, "rule": "high_risk_country"},
        )

    if country in LOW_RISK_COUNTRIES:
        factors.append("nationality_low_risk")
        return RiskScoreResult(
            tier=RiskTier.low,
            factors=factors,
            raw_response={"nationality": country, "rule": "low_risk_country"},
        )

    # Pakistan or default -> medium
    factors.append("nationality_default")
    return RiskScoreResult(
        tier=RiskTier.medium,
        factors=factors,
        raw_response={"nationality": country or "unknown", "rule": "default"},
    )
