"""Tests for billing service business logic."""

from app.modules.billing.service import EVENT_TYPE_TO_SERVICE
from app.models.billing import ServiceType


class TestEventTypeMapping:
    def test_kyc_events(self):
        assert EVENT_TYPE_TO_SERVICE["kyc.verification"] == ServiceType.kyc
        assert EVENT_TYPE_TO_SERVICE["identity.verify"] == ServiceType.kyc

    def test_screening_events(self):
        assert EVENT_TYPE_TO_SERVICE["screening.check"] == ServiceType.screening
        assert EVENT_TYPE_TO_SERVICE["screening.batch"] == ServiceType.screening

    def test_analytics_events(self):
        assert EVENT_TYPE_TO_SERVICE["analytics.query"] == ServiceType.analytics_l1
        assert EVENT_TYPE_TO_SERVICE["commercial.api"] == ServiceType.analytics_l3

    def test_compliance_events(self):
        assert EVENT_TYPE_TO_SERVICE["compliance.isar"] == ServiceType.reports
        assert EVENT_TYPE_TO_SERVICE["compliance.str"] == ServiceType.reports

    def test_form_events(self):
        assert EVENT_TYPE_TO_SERVICE["form.a5"] == ServiceType.form_generation
        assert EVENT_TYPE_TO_SERVICE["form.a6"] == ServiceType.form_generation

    def test_unknown_event(self):
        assert EVENT_TYPE_TO_SERVICE.get("unknown.event") is None
