"""
Phase 8.3: Encryption helpers for sensitive field encryption.

When ENCRYPTION_KEY is set (32-byte base64 Fernet key): encrypt/decrypt JSON-serializable values.
When not set: no-op passthrough for backward compatibility.

Use for: raw_response, ocr_data, or other PII-bearing JSONB fields.
"""

import base64
import json
import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


def _get_fernet():
    """Return Fernet instance if key configured."""
    key = getattr(settings, "encryption_key", "") or ""
    if not key or len(key) < 32:
        return None
    try:
        from cryptography.fernet import Fernet, InvalidToken
        # Fernet needs 32-byte base64url key
        k = key.encode() if isinstance(key, str) else key
        if len(k) == 32 and not base64.urlsafe_b64decode(k):
            k = base64.urlsafe_b64encode(k)
        elif len(k) != 44:
            k = base64.urlsafe_b64encode(k.ljust(32, b"\0")[:32])
        return Fernet(k)
    except Exception as e:
        logger.warning("Encryption key invalid: %s", e)
        return None


def encrypt_value(value: Any) -> bytes | None:
    """
    Encrypt JSON-serializable value. Returns None if encryption disabled.
    Caller should store as-is when None (unencrypted).
    """
    fernet = _get_fernet()
    if not fernet:
        return None
    try:
        data = json.dumps(value, default=str).encode()
        return fernet.encrypt(data)
    except Exception as e:
        logger.warning("Encryption failed: %s", e)
        return None


def decrypt_value(blob: bytes) -> Any | None:
    """
    Decrypt blob to JSON value. Returns None if decryption disabled or fails.
    """
    fernet = _get_fernet()
    if not fernet or not blob:
        return None
    try:
        data = fernet.decrypt(blob)
        return json.loads(data.decode())
    except Exception as e:
        logger.warning("Decryption failed: %s", e)
        return None


def is_encryption_enabled() -> bool:
    """True when ENCRYPTION_KEY is set and valid."""
    return _get_fernet() is not None
