"""Tests for RS256 JWT authentication."""

import pytest

from app.core.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_api_key,
    hash_password,
    verify_password,
)
from app.core.exceptions import AuthenticationError


class TestPasswordHashing:
    def test_hash_and_verify(self):
        hashed = hash_password("mypassword")
        assert verify_password("mypassword", hashed)
        assert not verify_password("wrongpassword", hashed)

    def test_different_hashes(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2  # bcrypt uses random salt


class TestApiKeyHashing:
    def test_deterministic(self):
        assert hash_api_key("key1") == hash_api_key("key1")

    def test_different_keys(self):
        assert hash_api_key("key1") != hash_api_key("key2")


class TestJwtTokens:
    def test_create_and_decode_access_token(self):
        token = create_access_token("user-123", "tenant-456", "mlro")
        payload = decode_token(token)
        assert payload["sub"] == "user-123"
        assert payload["tenant_id"] == "tenant-456"
        assert payload["role"] == "mlro"
        assert payload["type"] == "access"

    def test_create_and_decode_refresh_token(self):
        token = create_refresh_token("user-123")
        payload = decode_token(token)
        assert payload["sub"] == "user-123"
        assert payload["type"] == "refresh"

    def test_invalid_token_raises(self):
        with pytest.raises(AuthenticationError):
            decode_token("invalid.token.here")
