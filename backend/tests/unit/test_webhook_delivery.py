"""Tests for webhook delivery service."""

from unittest.mock import patch, MagicMock

from app.core.webhooks import deliver_webhook_sync, _sign_payload


class TestSignPayload:
    def test_deterministic(self):
        sig1 = _sign_payload(b"test", "secret")
        sig2 = _sign_payload(b"test", "secret")
        assert sig1 == sig2

    def test_different_payload(self):
        sig1 = _sign_payload(b"test1", "secret")
        sig2 = _sign_payload(b"test2", "secret")
        assert sig1 != sig2

    def test_different_secret(self):
        sig1 = _sign_payload(b"test", "secret1")
        sig2 = _sign_payload(b"test", "secret2")
        assert sig1 != sig2


class TestDeliverWebhookSync:
    @patch("app.core.webhooks.httpx.Client")
    def test_success(self, mock_client_cls):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.post.return_value = mock_response
        mock_client_cls.return_value = mock_client

        result = deliver_webhook_sync("https://example.com/hook", "test.event", {"key": "value"})
        assert result["success"] is True
        assert result["status_code"] == 200

    @patch("app.core.webhooks.httpx.Client")
    def test_failure(self, mock_client_cls):
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.post.return_value = mock_response
        mock_client_cls.return_value = mock_client

        result = deliver_webhook_sync("https://example.com/hook", "test.event", {"key": "value"})
        assert result["success"] is False
        assert result["status_code"] == 500

    def test_network_error(self):
        result = deliver_webhook_sync("https://nonexistent.invalid/hook", "test.event", {})
        assert result["success"] is False
        assert result["error"] is not None
