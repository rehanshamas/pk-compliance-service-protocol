"""Enhanced face matching adapter with ArcFace + face extraction from documents.

Upgrades over the basic face adapter:
- ArcFace model (more accurate than Facenet for face verification)
- Face crop from document image (extract face region from CNIC photo)
- Similarity score (0-100) instead of just distance
- Multiple face detection + largest face selection
"""

import logging
from dataclasses import dataclass

import cv2
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class FaceMatchResult:
    """Result of face comparison."""

    verified: bool
    similarity_score: float     # 0-100 (higher = more similar)
    distance: float             # raw model distance
    threshold: float            # distance threshold used
    model: str                  # model name used
    face_detected_in_doc: bool  # face found in document image
    face_detected_in_selfie: bool


@dataclass
class FaceCropResult:
    """Result of extracting a face from an image."""

    found: bool
    face_bytes: bytes | None = None     # cropped face image as JPEG bytes
    face_region: tuple | None = None    # (x, y, w, h) in original image
    confidence: float = 0.0


def _bytes_to_cv2(image_bytes: bytes) -> np.ndarray | None:
    """Convert raw bytes to OpenCV BGR image."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


def _detect_faces_opencv(img: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Detect faces using OpenCV Haar cascade. Returns list of (x, y, w, h)."""
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
    )
    return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in faces]


def crop_face_from_image(image_bytes: bytes, padding: float = 0.3) -> FaceCropResult:
    """
    Detect and crop the largest face from an image.
    Adds padding around the face for better matching context.
    """
    img = _bytes_to_cv2(image_bytes)
    if img is None:
        return FaceCropResult(found=False)

    faces = _detect_faces_opencv(img)
    if not faces:
        return FaceCropResult(found=False)

    # Select largest face
    largest = max(faces, key=lambda f: f[2] * f[3])
    x, y, w, h = largest

    # Add padding
    h_img, w_img = img.shape[:2]
    pad_w = int(w * padding)
    pad_h = int(h * padding)
    x1 = max(0, x - pad_w)
    y1 = max(0, y - pad_h)
    x2 = min(w_img, x + w + pad_w)
    y2 = min(h_img, y + h + pad_h)

    face_crop = img[y1:y2, x1:x2]

    # Encode to JPEG
    _, buffer = cv2.imencode(".jpg", face_crop, [cv2.IMWRITE_JPEG_QUALITY, 95])
    face_bytes = buffer.tobytes()

    face_area = w * h
    img_area = h_img * w_img
    confidence = min(face_area / img_area * 10, 1.0)  # rough confidence from face size

    return FaceCropResult(
        found=True,
        face_bytes=face_bytes,
        face_region=(x, y, w, h),
        confidence=confidence,
    )


class FaceEnhancedAdapter:
    """Enhanced face matching with ArcFace backend and document face extraction."""

    def __init__(self, model_name: str = "ArcFace", distance_threshold: float = 0.55):
        self.model_name = model_name
        self.distance_threshold = distance_threshold

    def extract_face_from_document(self, document_bytes: bytes) -> FaceCropResult:
        """Extract the face photo from an ID document (CNIC, passport, etc.)."""
        return crop_face_from_image(document_bytes, padding=0.2)

    def match_faces(
        self,
        image1_bytes: bytes,
        image2_bytes: bytes,
    ) -> FaceMatchResult:
        """
        Compare two face images. Returns similarity score 0-100.
        Typically: image1 = document face, image2 = selfie.
        """
        img1 = _bytes_to_cv2(image1_bytes)
        img2 = _bytes_to_cv2(image2_bytes)

        if img1 is None or img2 is None:
            return FaceMatchResult(
                verified=False,
                similarity_score=0,
                distance=1.0,
                threshold=self.distance_threshold,
                model=self.model_name,
                face_detected_in_doc=img1 is not None,
                face_detected_in_selfie=img2 is not None,
            )

        try:
            from deepface import DeepFace

            result = DeepFace.verify(
                img1, img2,
                model_name=self.model_name,
                enforce_detection=False,
                detector_backend="opencv",
            )

            distance = float(result.get("distance", 1.0))
            verified = bool(result.get("verified", False))

            # Convert distance to similarity score (0-100)
            # ArcFace cosine distance: 0 = identical, ~0.5 = threshold, ~1.0 = different
            similarity = max(0, min(100, (1 - distance) * 100))

            return FaceMatchResult(
                verified=verified,
                similarity_score=round(similarity, 1),
                distance=distance,
                threshold=self.distance_threshold,
                model=self.model_name,
                face_detected_in_doc=True,
                face_detected_in_selfie=True,
            )

        except Exception as e:
            logger.error("Face matching failed: %s", e)
            return FaceMatchResult(
                verified=False,
                similarity_score=0,
                distance=1.0,
                threshold=self.distance_threshold,
                model=self.model_name,
                face_detected_in_doc=False,
                face_detected_in_selfie=False,
            )

    def verify_document_vs_selfie(
        self,
        document_bytes: bytes,
        selfie_bytes: bytes,
    ) -> FaceMatchResult:
        """
        Full flow: extract face from document, then match against selfie.
        """
        # Step 1: Extract face from document
        doc_face = self.extract_face_from_document(document_bytes)
        if not doc_face.found or doc_face.face_bytes is None:
            logger.warning("No face found in document image")
            return FaceMatchResult(
                verified=False,
                similarity_score=0,
                distance=1.0,
                threshold=self.distance_threshold,
                model=self.model_name,
                face_detected_in_doc=False,
                face_detected_in_selfie=True,
            )

        # Step 2: Match document face vs selfie
        return self.match_faces(doc_face.face_bytes, selfie_bytes)
