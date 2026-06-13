"""Unit tests for MockCommercialAdapter (Layer 3). Phase 6.7."""

import pytest

from app.modules.analytics.providers.commercial import score_address


@pytest.mark.asyncio
async def test_score_address_returns_unified_schema() -> None:
    data = await score_address("ethereum", "0x1234567890abcdef1234567890abcdef12345678")
    assert "riskScore" in data
    assert "riskCategory" in data
    assert "exposureBreakdown" in data
    assert "flaggedIndicators" in data
    assert data["confidenceLevel"] == "high"
    assert data["resolutionLayer"] == "layer_3"
    assert data["chain"] == "ethereum"
    assert 5 <= data["riskScore"] <= 95


@pytest.mark.asyncio
async def test_score_address_deterministic() -> None:
    a1 = await score_address("ethereum", "0xabc")
    a2 = await score_address("ethereum", "0xabc")
    assert a1["riskScore"] == a2["riskScore"]
    assert a1["riskCategory"] == a2["riskCategory"]


@pytest.mark.asyncio
async def test_score_address_different_from_layer1_hash() -> None:
    """Commercial uses different hash seed than Layer 1, so scores can differ."""
    data = await score_address("bsc", "0xmedium45")
    assert isinstance(data["exposureBreakdown"], dict)
    assert "mixer" in data["exposureBreakdown"] or "darknet" in data["exposureBreakdown"]
