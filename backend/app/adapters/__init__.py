"""KYC verification adapters: OCR, face matching, liveness, NADRA."""

from app.adapters.ocr import OcrAdapter, extract_id_fields
from app.adapters.face import FaceAdapter, FaceMatchResult
from app.adapters.liveness import LivenessAdapter
from app.adapters.nadra import NadraAdapter, MockNadraAdapter, NadraVerifyResult

__all__ = [
    "OcrAdapter",
    "extract_id_fields",
    "FaceAdapter",
    "FaceMatchResult",
    "LivenessAdapter",
    "NadraAdapter",
    "MockNadraAdapter",
    "NadraVerifyResult",
]
