"""Document-in-hand verification adapter.

Verifies that a person is holding a physical document next to their face.
Detects both face AND document rectangle in the same camera frame.

Used in advanced KYC verification to confirm:
1. Real person (face detected + liveness)
2. Physical document present (not a screen showing a document)
3. Same person (face matches previously captured selfie)
"""

import logging
from dataclasses import dataclass

import cv2
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class DocumentInHandResult:
    """Result of document-in-hand verification."""

    face_detected: bool
    document_detected: bool
    both_present: bool          # face AND document in same frame
    face_region: tuple | None   # (x, y, w, h)
    document_region: tuple | None  # (x, y, w, h) of detected rectangle
    confidence: float           # 0-1.0 overall confidence


def _bytes_to_cv2(image_bytes: bytes) -> np.ndarray | None:
    nparr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


def _detect_face(img: np.ndarray) -> tuple | None:
    """Detect the largest face. Returns (x, y, w, h) or None."""
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(50, 50))
    if len(faces) == 0:
        return None
    # Largest face
    largest = max(faces, key=lambda f: f[2] * f[3])
    return tuple(int(v) for v in largest)


def _detect_document_rectangle(img: np.ndarray) -> tuple | None:
    """
    Detect a rectangular document (card-sized) in the image.
    Returns (x, y, w, h) bounding box or None.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Adaptive threshold for better edge detection in varying lighting
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )

    # Also try Canny edges
    edges = cv2.Canny(blurred, 30, 150)
    combined = cv2.bitwise_or(thresh, edges)

    contours, _ = cv2.findContours(combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    h_img, w_img = img.shape[:2]
    img_area = h_img * w_img

    candidates = []
    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:10]:
        area = cv2.contourArea(contour)

        # Document should be 5-50% of image area
        if area < img_area * 0.05 or area > img_area * 0.50:
            continue

        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)

        # Rectangle has 4 corners
        if len(approx) == 4:
            x, y, w, h = cv2.boundingRect(approx)
            aspect_ratio = w / h if h > 0 else 0

            # CNIC aspect ratio is approximately 1.586 (85.6mm x 53.98mm)
            # Allow range 1.2 to 2.0 for various card orientations
            if 1.2 <= aspect_ratio <= 2.0 or 0.5 <= aspect_ratio <= 0.83:
                candidates.append((x, y, w, h, area))

    if not candidates:
        return None

    # Return largest valid candidate
    best = max(candidates, key=lambda c: c[4])
    return (best[0], best[1], best[2], best[3])


def _regions_separate(face: tuple, doc: tuple, img_shape: tuple) -> bool:
    """Check that face and document regions don't overlap too much (they should be side by side)."""
    fx, fy, fw, fh = face
    dx, dy, dw, dh = doc

    # Calculate overlap area
    overlap_x = max(0, min(fx + fw, dx + dw) - max(fx, dx))
    overlap_y = max(0, min(fy + fh, dy + dh) - max(fy, dy))
    overlap_area = overlap_x * overlap_y

    face_area = fw * fh
    doc_area = dw * dh
    min_area = min(face_area, doc_area)

    # If overlap is more than 50% of smaller region, they're too overlapping
    if min_area > 0 and overlap_area / min_area > 0.5:
        return False

    return True


class DocumentInHandDetector:
    """Detects face + physical document in the same camera frame."""

    def check(self, image_bytes: bytes) -> DocumentInHandResult:
        """
        Analyze a frame for document-in-hand verification.

        Checks:
        1. Face is present in frame
        2. A rectangular document (card-sized) is present in frame
        3. Face and document are in separate regions (side by side, not overlapping)
        """
        img = _bytes_to_cv2(image_bytes)
        if img is None:
            return DocumentInHandResult(
                face_detected=False,
                document_detected=False,
                both_present=False,
                face_region=None,
                document_region=None,
                confidence=0,
            )

        # Detect face
        face = _detect_face(img)
        face_detected = face is not None

        # Detect document
        doc = _detect_document_rectangle(img)
        document_detected = doc is not None

        # Both must be present and separate
        both_present = False
        confidence = 0.0

        if face_detected and document_detected:
            separate = _regions_separate(face, doc, img.shape)
            if separate:
                both_present = True
                # Confidence based on detection quality
                h, w = img.shape[:2]
                face_size = (face[2] * face[3]) / (h * w)
                doc_size = (doc[2] * doc[3]) / (h * w)
                # Good if both are reasonable sizes
                confidence = min(
                    0.5 + face_size * 3 + doc_size * 2,
                    1.0
                )
            else:
                # Face and document overlap too much
                confidence = 0.3

        elif face_detected:
            confidence = 0.2
        elif document_detected:
            confidence = 0.1

        return DocumentInHandResult(
            face_detected=face_detected,
            document_detected=document_detected,
            both_present=both_present,
            face_region=face,
            document_region=doc,
            confidence=round(confidence, 2),
        )
