"""Tests for file validation with magic byte verification."""

import pytest
from app.core.file_validation import validate_file, validate_csv_upload


class TestValidateFile:
    def test_valid_jpeg(self):
        content = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        result = validate_file(content, "photo.jpg")
        assert result == "image/jpeg"

    def test_valid_png(self):
        content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        result = validate_file(content, "photo.png")
        assert result == "image/png"

    def test_valid_pdf(self):
        content = b"%PDF-1.4" + b"\x00" * 100
        result = validate_file(content, "doc.pdf")
        assert result == "application/pdf"

    def test_unrecognized_type(self):
        with pytest.raises(ValueError, match="not recognized"):
            validate_file(b"\x00\x01\x02\x03" * 10, "file.xyz")

    def test_too_small(self):
        with pytest.raises(ValueError, match="too small"):
            validate_file(b"\xff\xd8", "tiny.jpg")

    def test_too_large(self):
        content = b"\xff\xd8\xff\xe0" + b"\x00" * (11 * 1024 * 1024)
        with pytest.raises(ValueError, match="maximum size"):
            validate_file(content, "huge.jpg")

    def test_content_type_mismatch(self):
        content = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        with pytest.raises(ValueError, match="mismatch"):
            validate_file(content, "photo.jpg", declared_content_type="image/png")

    def test_pdf_with_javascript(self):
        content = b"%PDF-1.4 /JavaScript (alert)" + b"\x00" * 100
        with pytest.raises(ValueError, match="JavaScript"):
            validate_file(content, "malicious.pdf")

    def test_content_type_match(self):
        content = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        result = validate_file(content, "photo.jpg", declared_content_type="image/jpeg")
        assert result == "image/jpeg"


class TestValidateCsvUpload:
    def test_valid_csv(self):
        validate_csv_upload(b"name,dob\nJohn,1990-01-01", "data.csv")

    def test_missing_extension(self):
        with pytest.raises(ValueError, match=".csv"):
            validate_csv_upload(b"name,dob", "data.txt")

    def test_empty_csv(self):
        with pytest.raises(ValueError, match="empty"):
            validate_csv_upload(b"", "data.csv")

    def test_binary_content(self):
        with pytest.raises(ValueError, match="UTF-8"):
            validate_csv_upload(b"\xff\xfe\x00\x01" * 100, "data.csv")

    def test_no_filename(self):
        with pytest.raises(ValueError, match="Filename"):
            validate_csv_upload(b"content", "")
