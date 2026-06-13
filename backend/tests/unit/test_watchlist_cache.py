"""Tests for watchlist cache serialization."""

import json


class TestWatchlistCacheSerialization:
    def test_entry_roundtrip(self):
        entry = {
            "id": "abc-123",
            "source": "un",
            "entity_type": "individual",
            "primary_name": "Test Person",
            "aliases": ["Alias One"],
            "dob": "1990-01-01",
            "nationality": "PK",
            "id_numbers": [],
            "crypto_addresses": [],
        }
        serialized = json.dumps(entry)
        deserialized = json.loads(serialized)
        assert deserialized["primary_name"] == "Test Person"
        assert deserialized["aliases"] == ["Alias One"]
        assert deserialized["source"] == "un"
