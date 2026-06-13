"""Tests for rate limiting utilities."""

import base64
import json

from unittest.mock import MagicMock

from app.core.rate_limit import _extract_tenant_id_from_jwt, _get_client_ip


class TestExtractTenantId:
    def test_valid_jwt(self):
        payload = {"tenant_id": "abc-123", "sub": "user1"}
        payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
        token = f"header.{payload_b64}.signature"
        assert _extract_tenant_id_from_jwt(token) == "abc-123"

    def test_no_tenant_id(self):
        payload = {"sub": "user1"}
        payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
        token = f"header.{payload_b64}.signature"
        assert _extract_tenant_id_from_jwt(token) is None

    def test_malformed_token(self):
        assert _extract_tenant_id_from_jwt("not-a-jwt") is None

    def test_empty_string(self):
        assert _extract_tenant_id_from_jwt("") is None


class TestGetClientIp:
    def test_direct_connection(self):
        request = MagicMock()
        request.headers = {}
        request.client.host = "192.168.1.1"
        assert _get_client_ip(request) == "192.168.1.1"

    def test_forwarded_for(self):
        request = MagicMock()
        request.headers = {"x-forwarded-for": "10.0.0.1, 192.168.1.1"}
        assert _get_client_ip(request) == "10.0.0.1"
