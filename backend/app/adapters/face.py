"""Face matching adapter (Phase 4.5). DeepFace compares selfie vs ID photo."""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class FaceMatchResult:
    """Result of face comparison."""

    verified: bool
    distance: float
    threshold: float
    model: str


def compare_faces(
    id_image_bytes: bytes,
    selfie_bytes: bytes,
    threshold: float = 0.55,
) -> FaceMatchResult:
    """
    Compare face in ID document with selfie using DeepFace.
    Returns FaceMatchResult with verified=True if distance < threshold.
    """
    try:
        from deepface import DeepFace
        import numpy as np
        import cv2

        def bytes_to_array(b: bytes) -> "np.ndarray":
            nparr = np.frombuffer(b, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError("Could not decode image")
            return img

        img1 = bytes_to_array(id_image_bytes)
        img2 = bytes_to_array(selfie_bytes)
        result = DeepFace.verify(img1, img2, model_name="Facenet", enforce_detection=False)
        distance = float(result.get("distance", 1.0))
        verified = bool(result.get("verified", False))
        return FaceMatchResult(
            verified=verified,
            distance=distance,
            threshold=threshold,
            model="Facenet",
        )
    except ImportError as e:
        logger.warning("DeepFace not installed: %s", e)
        return FaceMatchResult(verified=False, distance=1.0, threshold=threshold, model="")
    except Exception as e:
        logger.warning("Face match failed: %s", e)
        return FaceMatchResult(verified=False, distance=1.0, threshold=threshold, model="")


class FaceAdapter:
    """Face matching adapter."""

    def __init__(self, threshold: float = 0.55):
        self.threshold = threshold

    def verify(
        self,
        id_image_bytes: bytes,
        selfie_bytes: bytes,
        threshold: float | None = None,
    ) -> FaceMatchResult:
        """Compare ID photo with selfie."""
        t = threshold if threshold is not None else self.threshold
        return compare_faces(id_image_bytes, selfie_bytes, threshold=t)
