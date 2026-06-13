"""EasyOCR adapter for Pakistani document OCR.

Supports Urdu + English text extraction from CNIC, passport, driving license.
Parses extracted text into structured fields specific to Pakistani documents.
"""

import logging
import re
from dataclasses import dataclass, field

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Lazy-loaded EasyOCR reader (heavy model, load once)
_reader = None


def _get_reader():
    """Lazy-load EasyOCR reader with English + Urdu support."""
    global _reader
    if _reader is None:
        import easyocr
        logger.info("Loading EasyOCR models (English + Urdu)... this takes ~10s first time")
        _reader = easyocr.Reader(["en", "ur"], gpu=False)
        logger.info("EasyOCR models loaded")
    return _reader


# ── Pakistani CNIC Patterns ──

# CNIC format: 35201-1234567-1 or 352011234567 1 (with/without dashes)
CNIC_PATTERN = re.compile(r"\b(\d{5})-?(\d{7})-?(\d)\b")

# Date patterns on CNIC
DATE_PATTERNS = [
    re.compile(r"\b(\d{2})[./\-](\d{2})[./\-](\d{4})\b"),   # DD/MM/YYYY or DD.MM.YYYY
    re.compile(r"\b(\d{4})[./\-](\d{2})[./\-](\d{2})\b"),   # YYYY-MM-DD
]

# Gender markers (English and Urdu)
GENDER_MALE = re.compile(r"\b(male|M|مرد)\b", re.IGNORECASE)
GENDER_FEMALE = re.compile(r"\b(female|F|عورت|خاتون)\b", re.IGNORECASE)

# Common CNIC field labels (English)
LABEL_NAME = re.compile(r"\b(name|نام)\b", re.IGNORECASE)
LABEL_FATHER = re.compile(r"\b(father|husband|والد|شوہر)\b", re.IGNORECASE)
LABEL_DOB = re.compile(r"\b(date.?of.?birth|DOB|تاریخ.?پیدائش|پیدائش)\b", re.IGNORECASE)
LABEL_EXPIRY = re.compile(r"\b(date.?of.?expiry|expiry|valid|میعاد)\b", re.IGNORECASE)
LABEL_GENDER = re.compile(r"\b(gender|sex|جنس)\b", re.IGNORECASE)
LABEL_ADDRESS = re.compile(r"\b(address|permanent|پتہ|مستقل)\b", re.IGNORECASE)


@dataclass
class CnicExtraction:
    """Structured data extracted from a Pakistani CNIC."""

    full_name: str | None = None
    father_husband_name: str | None = None
    cnic_number: str | None = None          # formatted: 35201-1234567-1
    date_of_birth: str | None = None        # YYYY-MM-DD
    date_of_expiry: str | None = None       # YYYY-MM-DD
    gender: str | None = None               # M / F
    address: str | None = None
    raw_text: str = ""
    raw_lines: list[str] = field(default_factory=list)
    confidence: float = 0.0
    is_front: bool = True                   # front or back of CNIC


def _normalize_cnic(match: re.Match) -> str:
    """Format CNIC as 35201-1234567-1."""
    return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"


def _parse_date(text: str) -> str | None:
    """Extract and normalize a date from text. Returns YYYY-MM-DD."""
    for pattern in DATE_PATTERNS:
        m = pattern.search(text)
        if not m:
            continue
        groups = m.groups()
        if len(groups[0]) == 4:  # YYYY-MM-DD
            return f"{groups[0]}-{groups[1]}-{groups[2]}"
        else:  # DD/MM/YYYY
            d, mo, y = groups[0].zfill(2), groups[1].zfill(2), groups[2]
            if int(y) > 1900 and int(mo) <= 12 and int(d) <= 31:
                return f"{y}-{mo}-{d}"
    return None


def _is_text_line(text: str) -> bool:
    """Check if a line is meaningful text (not just numbers or noise)."""
    clean = text.strip()
    if len(clean) < 2:
        return False
    digit_ratio = sum(c.isdigit() for c in clean) / max(len(clean), 1)
    return digit_ratio < 0.5


def _extract_near_label(lines: list[str], label_pattern: re.Pattern, offset: int = 1) -> str | None:
    """Find a label in lines and return the text near it (same line after colon, or next line)."""
    for i, line in enumerate(lines):
        if label_pattern.search(line):
            # Check for "Label: Value" on same line
            parts = re.split(r"[:：]", line, maxsplit=1)
            if len(parts) == 2 and len(parts[1].strip()) > 1:
                return parts[1].strip()
            # Otherwise take next line
            if i + offset < len(lines) and _is_text_line(lines[i + offset]):
                return lines[i + offset].strip()
    return None


def parse_cnic_front(lines: list[str], raw_text: str) -> CnicExtraction:
    """Parse CNIC front side OCR output into structured fields."""
    result = CnicExtraction(raw_text=raw_text, raw_lines=lines, is_front=True)

    # CNIC Number
    m = CNIC_PATTERN.search(raw_text)
    if m:
        result.cnic_number = _normalize_cnic(m)

    # Name (try label-based first, then heuristic)
    result.full_name = _extract_near_label(lines, LABEL_NAME)
    if not result.full_name:
        # Heuristic: first text-heavy line that's not a known label
        for line in lines:
            clean = line.strip()
            if (len(clean) > 3 and _is_text_line(clean)
                    and not CNIC_PATTERN.search(clean)
                    and not LABEL_DOB.search(clean)
                    and not LABEL_GENDER.search(clean)):
                result.full_name = clean
                break

    # Father/Husband name
    result.father_husband_name = _extract_near_label(lines, LABEL_FATHER)

    # Date of Birth
    dob_line = _extract_near_label(lines, LABEL_DOB)
    if dob_line:
        result.date_of_birth = _parse_date(dob_line)
    if not result.date_of_birth:
        # Try extracting any date from full text (first date is usually DOB on front)
        result.date_of_birth = _parse_date(raw_text)

    # Gender
    if GENDER_FEMALE.search(raw_text):
        result.gender = "F"
    elif GENDER_MALE.search(raw_text):
        result.gender = "M"

    # Date of Expiry (if present on front)
    expiry_line = _extract_near_label(lines, LABEL_EXPIRY)
    if expiry_line:
        result.date_of_expiry = _parse_date(expiry_line)

    return result


def parse_cnic_back(lines: list[str], raw_text: str) -> CnicExtraction:
    """Parse CNIC back side OCR output into structured fields."""
    result = CnicExtraction(raw_text=raw_text, raw_lines=lines, is_front=False)

    # CNIC Number (also on back)
    m = CNIC_PATTERN.search(raw_text)
    if m:
        result.cnic_number = _normalize_cnic(m)

    # Address (usually on back)
    result.address = _extract_near_label(lines, LABEL_ADDRESS)
    if not result.address:
        # Heuristic: longest text block on back is usually the address
        text_lines = [l.strip() for l in lines if _is_text_line(l) and len(l.strip()) > 10]
        if text_lines:
            result.address = " ".join(text_lines[:3])  # first 3 long lines

    # Expiry date (usually on back)
    expiry_line = _extract_near_label(lines, LABEL_EXPIRY)
    if expiry_line:
        result.date_of_expiry = _parse_date(expiry_line)

    return result


class EasyOcrAdapter:
    """OCR adapter using EasyOCR for multi-language document text extraction."""

    def extract_text(self, image_bytes: bytes) -> tuple[list[str], str, float]:
        """
        Run OCR on image bytes. Returns (lines, raw_text, avg_confidence).
        """
        try:
            reader = _get_reader()

            # Decode image
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return [], "", 0.0

            # Run EasyOCR
            results = reader.readtext(img)

            lines = []
            confidences = []
            for (bbox, text, conf) in results:
                lines.append(text.strip())
                confidences.append(conf)

            raw_text = "\n".join(lines)
            avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

            logger.debug("OCR extracted %d text blocks, avg confidence %.2f", len(lines), avg_conf)
            return lines, raw_text, avg_conf

        except Exception as e:
            logger.error("EasyOCR extraction failed: %s", e)
            return [], "", 0.0

    def extract_cnic_front(self, image_bytes: bytes) -> CnicExtraction:
        """Extract and parse Pakistani CNIC front side."""
        lines, raw_text, confidence = self.extract_text(image_bytes)
        result = parse_cnic_front(lines, raw_text)
        result.confidence = confidence
        return result

    def extract_cnic_back(self, image_bytes: bytes) -> CnicExtraction:
        """Extract and parse Pakistani CNIC back side."""
        lines, raw_text, confidence = self.extract_text(image_bytes)
        result = parse_cnic_back(lines, raw_text)
        result.confidence = confidence
        return result

    def extract_generic(self, image_bytes: bytes) -> CnicExtraction:
        """Extract text from any document (passport, license). Returns raw + best-effort parsing."""
        lines, raw_text, confidence = self.extract_text(image_bytes)
        result = CnicExtraction(raw_text=raw_text, raw_lines=lines, confidence=confidence)

        # Try to find CNIC number
        m = CNIC_PATTERN.search(raw_text)
        if m:
            result.cnic_number = _normalize_cnic(m)

        # Try to find a date
        result.date_of_birth = _parse_date(raw_text)

        # Try to find name (first text-heavy line)
        for line in lines:
            if _is_text_line(line) and len(line.strip()) > 3:
                result.full_name = line.strip()
                break

        return result
