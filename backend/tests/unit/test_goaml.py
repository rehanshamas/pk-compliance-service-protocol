"""Tests for goAML XML generation."""

from datetime import datetime, timezone
from unittest.mock import MagicMock
from xml.etree import ElementTree

from app.modules.compliance.goaml import generate_str_xml, generate_ctr_xml


def _mock_isar():
    isar = MagicMock()
    isar.id = "isar-001"
    isar.narrative = "Suspicious activity observed"
    isar.filed_at = datetime(2026, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
    return isar


def _mock_customer():
    customer = MagicMock()
    customer.full_name = "Test Customer"
    customer.nationality = "PK"
    customer.dob = None
    customer.cnic_number = None
    customer.created_at = datetime(2025, 6, 1, tzinfo=timezone.utc)
    return customer


def _mock_tenant():
    tenant = MagicMock()
    tenant.id = "tenant-001"
    tenant.name = "TestVASP PK"
    tenant.slug = "testvasp-pk"
    return tenant


class TestGenerateStrXml:
    def test_produces_valid_xml(self):
        xml_str = generate_str_xml(_mock_isar(), _mock_customer(), _mock_tenant())
        assert xml_str is not None
        # Should parse without error
        root = ElementTree.fromstring(xml_str)
        assert root.tag == "report"

    def test_contains_report_code_str(self):
        xml_str = generate_str_xml(_mock_isar(), _mock_customer(), _mock_tenant())
        root = ElementTree.fromstring(xml_str)
        report_code = root.find("report_code")
        assert report_code is not None
        assert report_code.text == "STR"

    def test_contains_currency_pkr(self):
        xml_str = generate_str_xml(_mock_isar(), _mock_customer(), _mock_tenant())
        assert "PKR" in xml_str

    def test_contains_entity_reference(self):
        xml_str = generate_str_xml(_mock_isar(), _mock_customer(), _mock_tenant())
        root = ElementTree.fromstring(xml_str)
        ref = root.find("entity_reference")
        assert ref is not None
        assert "isar-001" in ref.text


class TestGenerateCtrXml:
    def test_produces_valid_xml(self):
        xml_str = generate_ctr_xml(_mock_isar(), _mock_customer(), _mock_tenant())
        root = ElementTree.fromstring(xml_str)
        assert root.tag == "report"

    def test_report_code_is_ctr(self):
        xml_str = generate_ctr_xml(_mock_isar(), _mock_customer(), _mock_tenant())
        root = ElementTree.fromstring(xml_str)
        report_code = root.find("report_code")
        assert report_code is not None
        assert report_code.text == "CTR"
