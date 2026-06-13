"""Mock commercial API adapter. Layer 3 — fallback when Layers 1–2 confidence is low. Phase 6.7."""

from app.modules.analytics.models import Chain


def _score_to_category(score: int) -> str:
    if score >= 90:
        return "severe"
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


async def score_address(chain: str, address: str) -> dict:
    """
    Mock commercial API score. Simulates Scorechain/TRM-style response.
    Same schema as Layer 1/2. Used when Layers 1–2 confidence is below threshold.
    """
    addr = address.lower().strip()
    # Deterministic but different from Layer 1 (use different hash seed)
    h = hash(f"commercial:{chain}:{addr}")
    score = (abs(h) % 91) + 5  # 5–95 range, distinct from Layer 1
    category = _score_to_category(score)

    exposure = {
        "mixer": min(20, score // 5),
        "sanctioned": 0 if score < 85 else 15,
        "gambling": min(12, score // 8),
        "exchange": max(3, 45 - score // 2),
        "darknet": min(8, score // 12) if score >= 60 else 0,
        "high_risk_service": min(15, score // 7),
        "unknown": 0,
    }
    # Normalize to ~100
    total = sum(v for k, v in exposure.items() if k != "unknown")
    exposure["unknown"] = max(0, 100 - total)

    flagged = []
    if score >= 65:
        flagged.append("MIXER_EXPOSURE")
    if score >= 75:
        flagged.append("DARKNET_2HOP")
    if score >= 85:
        flagged.append("SANCTIONS_PROXIMITY")
    if score >= 50:
        flagged.append("COMMERCIAL_VERIFIED")

    chain_enum = Chain.ethereum
    try:
        chain_enum = Chain(chain.lower().strip())
    except ValueError:
        pass

    return {
        "walletId": None,  # Assigned by service when persisting
        "address": addr,
        "chain": chain_enum.value,
        "riskScore": score,
        "riskCategory": category,
        "exposureBreakdown": exposure,
        "flaggedIndicators": flagged,
        "confidenceLevel": "high",  # Commercial API returns high confidence
        "resolutionLayer": "layer_3",
        "chainsAnalyzed": [chain_enum.value],
        "cached": False,
    }
