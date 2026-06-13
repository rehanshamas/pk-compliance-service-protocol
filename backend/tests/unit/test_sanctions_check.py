"""Unit tests for sanctions wallet cross-reference. Phase 6.3."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.modules.analytics.sanctions_check import is_sanctioned_address, get_sanctioned_entries_for_address


@pytest.mark.asyncio
async def test_is_sanctioned_address_match_string():
    """Address in crypto_addresses (string) returns True."""
    db = AsyncMock()
    db.execute = AsyncMock()
    result = MagicMock()
    result.all.return_value = [
        MagicMock(crypto_addresses=["0xabc123", "0xSANCTIONED123"]),
    ]
    db.execute.return_value = result

    out = await is_sanctioned_address(db, "0xsanctioned123")
    assert out is True


@pytest.mark.asyncio
async def test_is_sanctioned_address_no_match():
    """Address not in list returns False."""
    db = AsyncMock()
    db.execute = AsyncMock()
    result = MagicMock()
    result.all.return_value = [
        MagicMock(crypto_addresses=["0xother1", "0xother2"]),
    ]
    db.execute.return_value = result

    out = await is_sanctioned_address(db, "0xnotlisted")
    assert out is False


@pytest.mark.asyncio
async def test_get_sanctioned_entries_for_address():
    """Returns source and primaryName for matching entries."""
    db = AsyncMock()
    db.execute = AsyncMock()
    row = MagicMock()
    row.source = MagicMock(value="ofac")
    row.primary_name = "SANCTIONED ENTITY"
    row.crypto_addresses = ["0xmatch123"]
    result = MagicMock()
    result.all.return_value = [row]
    db.execute.return_value = result

    out = await get_sanctioned_entries_for_address(db, "0xmatch123")
    assert len(out) == 1
    assert out[0]["source"] == "ofac"
    assert out[0]["primaryName"] == "SANCTIONED ENTITY"
