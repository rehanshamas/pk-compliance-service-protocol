"""Unit tests for risk scoring engine (Phase 4.8)."""

import pytest
from app.modules.identity.risk_scoring import score_customer_risk


def test_prohibited_country():
    """Prohibited country -> prohibited tier."""
    r = score_customer_risk(nationality="IR", pep_match=False)
    assert r.tier.value == "prohibited"
    assert "nationality_prohibited" in r.factors


def test_high_risk_country():
    """High-risk country -> high tier."""
    r = score_customer_risk(nationality="AF", pep_match=False)
    assert r.tier.value == "high"
    assert "nationality_high_risk" in r.factors


def test_low_risk_country():
    """Low-risk country -> low tier."""
    r = score_customer_risk(nationality="US", pep_match=False)
    assert r.tier.value == "low"
    assert "nationality_low_risk" in r.factors


def test_pakistan_medium():
    """Pakistan -> medium tier."""
    r = score_customer_risk(nationality="PK", pep_match=False)
    assert r.tier.value == "medium"
    assert "nationality_default" in r.factors


def test_pep_match_high():
    """PEP match (no high-risk country) -> high tier."""
    r = score_customer_risk(nationality="PK", pep_match=True)
    assert r.tier.value == "high"
    assert "pep_true_positive" in r.factors


def test_pep_plus_high_risk_prohibited():
    """PEP match + high-risk country -> prohibited."""
    r = score_customer_risk(nationality="AF", pep_match=True)
    assert r.tier.value == "prohibited"
    assert "pep_true_positive" in r.factors
    assert "pep_plus_high_risk_country" in r.factors


def test_normalizes_country_code():
    """Country code is normalized to 2-letter uppercase."""
    r = score_customer_risk(nationality="  us  ", pep_match=False)
    assert r.tier.value == "low"


def test_null_nationality_defaults_medium():
    """Null/empty nationality -> medium."""
    r = score_customer_risk(nationality=None, pep_match=False)
    assert r.tier.value == "medium"
