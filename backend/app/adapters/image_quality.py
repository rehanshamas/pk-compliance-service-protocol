"""Image quality checker for KYC document and selfie captures.

Checks: blur, brightness, resolution, face presence.
Returns quality score and specific issues found.
"""

import logging
from dataclasses import dataclass, field

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Thresholds
MIN_RESOLUTION = 480          # minimum dimension in pixels
BLUR_THRESHOLD = 80.0         # Laplacian variance below this = blurry
BRIGHTNESS_LOW = 40           # mean brightness below this = too dark
BRIGHTNESS_HIGH = 220         # mean brightness above this = too bright (glare)
MIN_FACE_SIZE_RATIO = 0.08    # face must be at least 8% of image area


@dataclass
class QualityIssue:
    code: str       # e.g., "BLURRY", "TOO_DARK", "LOW_RESOLUTION"
    message: str
    severity: str   # "error" (reject) or "warning" (allow but flag)


@dataclass
class QualityResult:
    passed: bool
    score: float              # 0-100 overall quality
    issues: list[QualityIssue] = field(default_factory=list)


def _bytes_to_cv2(image_bytes: bytes) -> np.ndarray | None:
    """Convert raw bytes to OpenCV BGR image."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img


def check_resolution(img: np.ndarray) -> QualityIssue | None:
    """Check minimum resolution."""
    h, w = img.shape[:2]
    if min(h, w) < MIN_RESOLUTION:
        return QualityIssue(
            code="LOW_RESOLUTION",
            message=f"Image too small ({w}x{h}). Minimum {MIN_RESOLUTION}px required.",
            severity="error",
        )
    return None


def check_blur(img: np.ndarray) -> tuple[float, QualityIssue | None]:
    """Check image sharpness using Laplacian variance."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    if variance < BLUR_THRESHOLD:
        return variance, QualityIssue(
            code="BLURRY",
            message="Image is blurry. Please hold camera steady and ensure good focus.",
            severity="error",
        )
    return variance, None


def check_brightness(img: np.ndarray) -> tuple[float, QualityIssue | None]:
    """Check image brightness."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mean_brightness = np.mean(gray)
    if mean_brightness < BRIGHTNESS_LOW:
        return mean_brightness, QualityIssue(
            code="TOO_DARK",
            message="Image is too dark. Please move to a well-lit area.",
            severity="error",
        )
    if mean_brightness > BRIGHTNESS_HIGH:
        return mean_brightness, QualityIssue(
            code="TOO_BRIGHT",
            message="Image has glare or is overexposed. Avoid direct light on the document.",
            severity="warning",
        )
    return mean_brightness, None


def check_face_present(img: np.ndarray) -> tuple[bool, QualityIssue | None]:
    """Check if a face is detected in the image (for selfie/liveness frames)."""
    try:
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)
        if len(faces) == 0:
            return False, QualityIssue(
                code="NO_FACE",
                message="No face detected. Please face the camera directly.",
                severity="error",
            )
        # Check face is large enough
        h, w = img.shape[:2]
        img_area = h * w
        for (fx, fy, fw, fh) in faces:
            face_area = fw * fh
            if face_area / img_area >= MIN_FACE_SIZE_RATIO:
                return True, None
        return True, QualityIssue(
            code="FACE_TOO_SMALL",
            message="Face is too far from camera. Please move closer.",
            severity="warning",
        )
    except Exception as e:
        logger.warning("Face detection failed: %s", e)
        return False, None


def check_document_edges(img: np.ndarray) -> tuple[bool, QualityIssue | None]:
    """Check if a rectangular document is detected in the image."""
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        h, w = img.shape[:2]
        img_area = h * w

        for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
            if len(approx) == 4 and cv2.contourArea(contour) > img_area * 0.1:
                return True, None

        return False, QualityIssue(
            code="NO_DOCUMENT",
            message="Document edges not detected. Place the document on a flat, contrasting surface.",
            severity="warning",
        )
    except Exception as e:
        logger.warning("Document edge detection failed: %s", e)
        return False, None


class ImageQualityChecker:
    """Checks image quality for KYC capture frames."""

    def check_document(self, image_bytes: bytes) -> QualityResult:
        """Check quality of a document capture (CNIC front/back)."""
        img = _bytes_to_cv2(image_bytes)
        if img is None:
            return QualityResult(passed=False, score=0, issues=[
                QualityIssue("DECODE_FAILED", "Could not read image file.", "error")
            ])

        issues: list[QualityIssue] = []
        scores: list[float] = []

        # Resolution
        issue = check_resolution(img)
        if issue:
            issues.append(issue)
            scores.append(0)
        else:
            h, w = img.shape[:2]
            scores.append(min(min(h, w) / 1000, 1.0) * 100)

        # Blur
        variance, issue = check_blur(img)
        if issue:
            issues.append(issue)
        scores.append(min(variance / 200, 1.0) * 100)

        # Brightness
        brightness, issue = check_brightness(img)
        if issue:
            issues.append(issue)
        bright_score = 100 - abs(brightness - 130) / 1.3  # best around 130
        scores.append(max(bright_score, 0))

        # Document edges
        found, issue = check_document_edges(img)
        if issue:
            issues.append(issue)
        scores.append(80 if found else 40)

        overall = sum(scores) / len(scores) if scores else 0
        has_errors = any(i.severity == "error" for i in issues)

        return QualityResult(passed=not has_errors, score=round(overall, 1), issues=issues)

    def check_selfie(self, image_bytes: bytes) -> QualityResult:
        """Check quality of a selfie capture."""
        img = _bytes_to_cv2(image_bytes)
        if img is None:
            return QualityResult(passed=False, score=0, issues=[
                QualityIssue("DECODE_FAILED", "Could not read image file.", "error")
            ])

        issues: list[QualityIssue] = []
        scores: list[float] = []

        # Resolution
        issue = check_resolution(img)
        if issue:
            issues.append(issue)
            scores.append(0)
        else:
            h, w = img.shape[:2]
            scores.append(min(min(h, w) / 1000, 1.0) * 100)

        # Blur
        variance, issue = check_blur(img)
        if issue:
            issues.append(issue)
        scores.append(min(variance / 200, 1.0) * 100)

        # Brightness
        brightness, issue = check_brightness(img)
        if issue:
            issues.append(issue)
        scores.append(max(100 - abs(brightness - 130) / 1.3, 0))

        # Face present
        found, issue = check_face_present(img)
        if issue:
            issues.append(issue)
        scores.append(90 if found else 10)

        overall = sum(scores) / len(scores) if scores else 0
        has_errors = any(i.severity == "error" for i in issues)

        return QualityResult(passed=not has_errors, score=round(overall, 1), issues=issues)

    def check_liveness_frame(self, image_bytes: bytes) -> QualityResult:
        """Check quality of a liveness/document-in-hand frame."""
        img = _bytes_to_cv2(image_bytes)
        if img is None:
            return QualityResult(passed=False, score=0, issues=[
                QualityIssue("DECODE_FAILED", "Could not read image file.", "error")
            ])

        issues: list[QualityIssue] = []

        # Must have face
        found, issue = check_face_present(img)
        if issue:
            issues.append(issue)

        # Brightness
        _, issue = check_brightness(img)
        if issue:
            issues.append(issue)

        # Blur
        _, issue = check_blur(img)
        if issue:
            issues.append(issue)

        has_errors = any(i.severity == "error" for i in issues)
        score = 90 if not has_errors else 30

        return QualityResult(passed=not has_errors, score=score, issues=issues)
