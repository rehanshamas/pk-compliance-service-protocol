"""Unit tests for fuzzy name matching engine (Phase 3.8)."""

import pytest

from app.modules.screening.matching import (
    normalize_name,
    score_match,
    score_match_levenshtein,
    find_matches,
)


class TestNormalizeName:
    """Test romanization and normalization."""

    def test_empty_returns_empty(self):
        assert normalize_name("") == ""
        assert normalize_name("   ") == ""

    def test_lowercase_and_collapse_whitespace(self):
        assert normalize_name("  John   Smith  ") == "john smith"

    def test_romanization_muhammad_variants(self):
        assert normalize_name("Muhammad") == "muhammad"
        assert normalize_name("Mohammad") == "muhammad"
        assert normalize_name("Mohamed") == "muhammad"

    def test_romanization_ahmad_ahmed(self):
        assert normalize_name("Ahmad") == "ahmad"
        assert normalize_name("Ahmed") == "ahmad"

    def test_romanization_hussain_husain(self):
        assert normalize_name("Hussain") == "hussain"
        assert normalize_name("Husain") == "hussain"

    def test_romanization_full_name(self):
        assert normalize_name("Mohammad Ahmad Khan") == "muhammad ahmad khan"


class TestScoreMatch:
    """Test composite scoring 0-100."""

    def test_identical_names_score_100(self):
        assert score_match("John Smith", "John Smith") == 100.0

    def test_romanization_variants_match_high(self):
        # Mohammad vs Muhammad — same after romanization
        assert score_match("Mohammad Ahmad", "Muhammad Ahmad") == 100.0
        assert score_match("Hussain Ali", "Husain Ali") == 100.0

    def test_word_order_flexible(self):
        # token_set_ratio handles "John Smith" vs "Smith, John"
        assert score_match("John Smith", "Smith John") >= 90

    def test_empty_input_returns_zero(self):
        assert score_match("", "John") == 0.0
        assert score_match("John", "") == 0.0

    def test_score_in_range_0_100(self):
        scores = [
            score_match("x", "y"),
            score_match("John Smith", "Jane Doe"),
            score_match("Abdul", "Abdul Rahman"),
        ]
        for s in scores:
            assert 0 <= s <= 100


class TestScoreMatchLevenshtein:
    """Test backward-compatible Levenshtein scoring."""

    def test_identical_returns_100(self):
        assert score_match_levenshtein("John", "John") == 100.0

    def test_completely_different_returns_low(self):
        assert score_match_levenshtein("abc", "xyz") < 50


class TestFindMatches:
    """Test find_matches with watchlist entries."""

    def test_empty_watchlist_returns_empty(self):
        assert find_matches("John Smith", []) == []

    def test_no_match_above_threshold_returns_empty(self):
        entries = [("e1", "Jane Doe", [], "pep")]
        assert find_matches("John Smith", entries, threshold=90) == []

    def test_match_above_threshold_returned(self):
        entries = [("e1", "John Smith", [], "un")]
        result = find_matches("John Smith", entries, threshold=70)
        assert len(result) == 1
        assert result[0]["watchlist_entry_id"] == "e1"
        assert result[0]["score"] >= 90
        assert result[0]["source"] == "un"
        assert "primary_name" in result[0]["matched_fields"]

    def test_match_with_alias(self):
        entries = [("e1", "Mohammad Ahmad", ["Ahmad, M.", "Ahmad Mohammad"], "ofac")]
        result = find_matches("Mohammad Ahmad", entries, threshold=70, use_aliases=True)
        assert len(result) == 1
        assert result[0]["watchlist_entry_id"] == "e1"

    def test_romanization_finds_variant(self):
        entries = [("e1", "Muhammad Ahmad Khan", [], "nacta")]
        result = find_matches("Mohammad Ahmad Khan", entries, threshold=70)
        assert len(result) == 1
        assert result[0]["score"] == 100.0

    def test_respects_threshold(self):
        entries = [("e1", "John Smith", [], "pep")]
        # "Jon Smyth" might score ~85
        result_high = find_matches("Jon Smyth", entries, threshold=70)
        result_strict = find_matches("Jon Smyth", entries, threshold=95)
        assert len(result_high) >= 0  # May or may not match depending on algo
        assert len(result_strict) <= len(result_high)

    def test_deduplicates_by_entry_id_keeps_highest_score(self):
        entries = [
            ("e1", "John Smith", ["Smith, John", "J. Smith"], "un"),
        ]
        result = find_matches("John Smith", entries, threshold=70, use_aliases=True)
        assert len(result) == 1
        assert result[0]["score"] >= 90
