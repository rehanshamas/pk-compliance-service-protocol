"""Unit tests for alert severity from screening matches."""

import pytest

from app.modules.alerts.service import severity_from_screening_match


class TestSeverityFromScreeningMatch:
    """Severity based on source + score."""

    def test_empty_matches_returns_low(self):
        assert severity_from_screening_match([], "clear") == "low"

    def test_sanctions_high_score_critical(self):
        m = [{"score": 92, "source": "un"}]
        assert severity_from_screening_match(m, "confirmed_match") == "critical"

    def test_sanctions_90_critical(self):
        m = [{"score": 90, "source": "ofac"}]
        assert severity_from_screening_match(m, "confirmed_match") == "critical"

    def test_sanctions_85_high(self):
        m = [{"score": 85, "source": "eu"}]
        assert severity_from_screening_match(m, "confirmed_match") == "high"

    def test_sanctions_75_medium(self):
        m = [{"score": 75, "source": "nacta"}]
        assert severity_from_screening_match(m, "confirmed_match") == "medium"

    def test_pep_90_high(self):
        m = [{"score": 90, "source": "pep"}]
        assert severity_from_screening_match(m, "potential_match") == "high"

    def test_pep_85_medium(self):
        m = [{"score": 85, "source": "pep"}]
        assert severity_from_screening_match(m, "potential_match") == "medium"

    def test_pep_75_low(self):
        m = [{"score": 75, "source": "pep"}]
        assert severity_from_screening_match(m, "potential_match") == "low"

    def test_unknown_source_treated_like_pep(self):
        m = [{"score": 92, "source": "opensanctions"}]
        assert severity_from_screening_match(m, "confirmed_match") == "high"

    def test_missing_score_defaults_safe(self):
        m = [{"source": "un"}]
        assert severity_from_screening_match(m, "confirmed_match") == "low"
