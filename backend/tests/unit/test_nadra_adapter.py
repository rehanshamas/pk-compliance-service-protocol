"""Unit tests for NADRA MockNadraAdapter (Phase 4.7)."""

import pytest
from app.adapters.nadra import MockNadraAdapter


@pytest.mark.asyncio
async def test_mock_nadra_35201_pass_lahore():
    """CNIC 35201-XXXXXXX-X → PASS (Lahore)."""
    adapter = MockNadraAdapter()
    result = await adapter.verify_cnic(
        cnic="35201-1234567-1",
        name="Test User",
        dob="1990-01-01",
    )
    assert result.verified is True
    assert result.city == "Lahore"
    assert result.raw_response["status"] == "pass"
    assert result.raw_response["city"] == "Lahore"


@pytest.mark.asyncio
async def test_mock_nadra_42101_pass_karachi():
    """CNIC 42101-XXXXXXX-X → PASS (Karachi)."""
    adapter = MockNadraAdapter()
    result = await adapter.verify_cnic(
        cnic="42101-9876543-2",
        name="Karachi Resident",
        dob=None,
    )
    assert result.verified is True
    assert result.city == "Karachi"
    assert result.raw_response["status"] == "pass"
    assert result.raw_response["city"] == "Karachi"


@pytest.mark.asyncio
async def test_mock_nadra_00000_fail():
    """CNIC 00000-XXXXXXX-X → FAIL."""
    adapter = MockNadraAdapter()
    result = await adapter.verify_cnic(
        cnic="00000-1111111-1",
        name="Invalid",
        dob="2000-01-01",
    )
    assert result.verified is False
    assert result.city is None
    assert result.raw_response["status"] == "fail"
    assert "reason" in result.raw_response


@pytest.mark.asyncio
async def test_mock_nadra_other_pass_with_delay():
    """All other CNICs → PASS with 500ms delay."""
    adapter = MockNadraAdapter()
    result = await adapter.verify_cnic(
        cnic="12345-5555555-5",
        name="Other User",
        dob="1985-06-15",
    )
    assert result.verified is True
    assert result.raw_response["status"] == "pass"


@pytest.mark.asyncio
async def test_mock_nadra_normalizes_cnic():
    """CNIC without dashes is normalized."""
    adapter = MockNadraAdapter()
    result = await adapter.verify_cnic(
        cnic="3520112345671",
        name="Normalized",
        dob=None,
    )
    assert result.verified is True
    assert result.cnic == "35201-1234567-1"
    assert result.city == "Lahore"
