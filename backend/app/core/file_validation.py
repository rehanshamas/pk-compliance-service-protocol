"""File validation with magic byte verification."""

from __future__ import annotations

MAGIC_SIGNATURES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "application/pdf": [b"%PDF"],
}

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "application/pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def validate_file(content: bytes, filename: str, declared_content_type: str | None = None) -> str:
    """Validate file by magic bytes and size. Returns detected content type.

    Raises ValueError with descriptive message on validation failure.
    """
    if len(content) > MAX_FILE_SIZE:
        raise ValueError(f"File exceeds maximum size of {MAX_FILE_SIZE // (1024*1024)}MB")

    if len(content) < 4:
        raise ValueError("File is too small to be valid")

    detected_type = None
    for content_type, signatures in MAGIC_SIGNATURES.items():
        for sig in signatures:
            if content.startswith(sig):
                detected_type = content_type
                break
        if detected_type:
            break

    if detected_type is None:
        raise ValueError("File type not recognized. Allowed types: JPEG, PNG, PDF")

    if detected_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError(f"File type {detected_type} is not allowed")

    if declared_content_type and declared_content_type != detected_type:
        raise ValueError(
            f"Content-type mismatch: declared {declared_content_type}, detected {detected_type}"
        )

    # Additional checks
    if detected_type == "application/pdf":
        # Check for JavaScript in PDF (basic XSS prevention)
        content_str = content[:10000].decode("latin-1", errors="ignore").lower()
        if "/javascript" in content_str or "/js " in content_str:
            raise ValueError("PDF contains potentially dangerous JavaScript")

    return detected_type


def validate_csv_upload(content: bytes, filename: str) -> None:
    """Validate a CSV file upload by extension and basic content checks.

    CSV has no magic bytes, so we validate by filename extension and
    check that the content is decodable as UTF-8 text.

    Raises ValueError with descriptive message on validation failure.
    """
    if not filename:
        raise ValueError("Filename is required for CSV validation")

    if not filename.lower().endswith(".csv"):
        raise ValueError("File must have a .csv extension")

    if len(content) == 0:
        raise ValueError("CSV file is empty")

    if len(content) > MAX_FILE_SIZE:
        raise ValueError(f"File exceeds maximum size of {MAX_FILE_SIZE // (1024*1024)}MB")

    # Verify the content is valid text (not a binary file renamed to .csv)
    try:
        content.decode("utf-8")
    except UnicodeDecodeError:
        raise ValueError("CSV file contains invalid UTF-8 characters; it may not be a valid text file")
