"""Document OCR adapter (Phase 4.4). Tesseract extracts name, DOB, CNIC from ID images."""

import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class OcrExtraction:
    """Extracted fields from ID document OCR."""

    full_name: str | None
    dob: str | None
    cnic_number: str | None
    raw_text: str
    confidence: float


# Pakistani CNIC format: 35201-1234567-1 (5 digits, dash, 7 digits, dash, 1 digit)
CNIC_PATTERN = re.compile(r"\b\d{5}-\d{7}-\d\b")

# Common date patterns: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
DATE_PATTERN_ISO = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")
DATE_PATTERN_DMY = re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b")


def _normalize_cnic(s: str) -> str:
    """Normalize CNIC (remove spaces, ensure dashes)."""
    s = s.replace(" ", "")
    if len(s) == 13 and s.isdigit():
        return f"{s[:5]}-{s[5:12]}-{s[12]}"
    return s


def _parse_date_from_text(text: str) -> str | None:
    """Extract first plausible date from text. Returns YYYY-MM-DD."""
    m = DATE_PATTERN_ISO.search(text)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = DATE_PATTERN_DMY.search(text)
    if m:
        d, mon, y = m.group(1).zfill(2), m.group(2).zfill(2), m.group(3)
        return f"{y}-{mon}-{d}"
    return None


def extract_id_fields(image_bytes: bytes, content_type: str) -> OcrExtraction:
    """
    Run OCR on ID image bytes and extract name, DOB, CNIC.
    For PDF, OCR is skipped (returns empty extraction).
    """
    raw_text = ""
    confidence = 0.0

    if "pdf" in content_type.lower():
        logger.info("OCR skipped for PDF (image-only supported)")
        return OcrExtraction(
            full_name=None,
            dob=None,
            cnic_number=None,
            raw_text="",
            confidence=0.0,
        )

    try:
        import pytesseract
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(image_bytes))
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        raw_text = pytesseract.image_to_string(img, lang="eng")
        data = pytesseract.image_to_data(img, lang="eng", output_type=pytesseract.Output.DICT)
        confs = [int(c) for c in data["conf"] if c != "-1"]
        confidence = sum(confs) / len(confs) / 100.0 if confs else 0.0
    except ImportError as e:
        logger.warning("pytesseract or PIL not installed: %s", e)
        return OcrExtraction(None, None, None, "", 0.0)
    except Exception as e:
        logger.warning("OCR failed: %s", e)
        return OcrExtraction(None, None, None, raw_text or "", 0.0)

    # Extract CNIC
    cnic_match = CNIC_PATTERN.search(raw_text)
    cnic_number = _normalize_cnic(cnic_match.group(0)) if cnic_match else None

    # Extract date
    dob = _parse_date_from_text(raw_text)

    # Name: heuristic - often first long line before numbers, or line containing "Name"/"Father"
    # Simplified: take first line with 2+ words that isn't mostly digits
    full_name = None
    for line in raw_text.splitlines():
        line = line.strip()
        if len(line) < 4:
            continue
        digit_ratio = sum(c.isdigit() for c in line) / max(len(line), 1)
        if digit_ratio < 0.3 and " " in line:
            full_name = " ".join(line.split())
            break
        elif digit_ratio < 0.2 and len(line) > 6:
            full_name = line
            break

    return OcrExtraction(
        full_name=full_name,
        dob=dob,
        cnic_number=cnic_number,
        raw_text=raw_text,
        confidence=min(1.0, confidence),
    )


class OcrAdapter:
    """Abstract OCR adapter interface."""

    def extract(self, image_bytes: bytes, content_type: str) -> OcrExtraction:
        """Extract ID fields from image. Override for different backends."""
        return extract_id_fields(image_bytes, content_type)
