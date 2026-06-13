"""Advanced liveness detection adapter.

Two-layer liveness verification:
1. Active liveness challenges (blink detection, head pose) via MediaPipe Face Mesh
2. Anti-spoofing (detect photo/screen/mask attacks) via texture analysis

No external API dependencies. Runs entirely on CPU.
"""

import logging
from dataclasses import dataclass, field
from enum import Enum

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Lazy-loaded MediaPipe
_face_mesh = None


def _get_face_mesh():
    """Lazy-load MediaPipe Face Mesh."""
    global _face_mesh
    if _face_mesh is None:
        import mediapipe as mp
        _face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
        )
        logger.info("MediaPipe Face Mesh loaded")
    return _face_mesh


class LivenessChallenge(str, Enum):
    BLINK = "blink"
    TURN_LEFT = "turn_left"
    TURN_RIGHT = "turn_right"
    NOD = "nod"


@dataclass
class LivenessCheckResult:
    """Result of a single liveness frame analysis."""

    is_live: bool
    confidence: float           # 0-1.0
    anti_spoof_score: float     # 0-1.0 (higher = more likely real)
    challenges_passed: list[str] = field(default_factory=list)
    challenges_failed: list[str] = field(default_factory=list)
    details: dict = field(default_factory=dict)


@dataclass
class BlinkResult:
    """Eye aspect ratio analysis for blink detection."""

    left_ear: float     # eye aspect ratio
    right_ear: float
    is_blinking: bool
    avg_ear: float


@dataclass
class HeadPoseResult:
    """Head orientation estimation."""

    yaw: float      # left/right rotation (degrees)
    pitch: float    # up/down rotation (degrees)
    roll: float     # tilt (degrees)


def _bytes_to_cv2(image_bytes: bytes) -> np.ndarray | None:
    nparr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


# ── Eye Aspect Ratio (EAR) for Blink Detection ──

# MediaPipe Face Mesh landmark indices for eyes
LEFT_EYE = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33, 160, 158, 133, 153, 144]

EAR_BLINK_THRESHOLD = 0.21  # below this = eyes closed


def _eye_aspect_ratio(landmarks, eye_indices, img_w, img_h) -> float:
    """Calculate eye aspect ratio from face mesh landmarks."""
    points = []
    for idx in eye_indices:
        lm = landmarks[idx]
        points.append((lm.x * img_w, lm.y * img_h))

    # EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
    p1, p2, p3, p4, p5, p6 = points

    vertical1 = np.linalg.norm(np.array(p2) - np.array(p6))
    vertical2 = np.linalg.norm(np.array(p3) - np.array(p5))
    horizontal = np.linalg.norm(np.array(p1) - np.array(p4))

    if horizontal == 0:
        return 0.3  # default open

    return (vertical1 + vertical2) / (2.0 * horizontal)


def detect_blink(image_bytes: bytes) -> BlinkResult:
    """Detect if eyes are closed (blinking) in the image."""
    img = _bytes_to_cv2(image_bytes)
    if img is None:
        return BlinkResult(0, 0, False, 0)

    h, w = img.shape[:2]
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    face_mesh = _get_face_mesh()
    results = face_mesh.process(rgb)

    if not results.multi_face_landmarks:
        return BlinkResult(0, 0, False, 0)

    landmarks = results.multi_face_landmarks[0].landmark
    left_ear = _eye_aspect_ratio(landmarks, LEFT_EYE, w, h)
    right_ear = _eye_aspect_ratio(landmarks, RIGHT_EYE, w, h)
    avg_ear = (left_ear + right_ear) / 2.0

    return BlinkResult(
        left_ear=round(left_ear, 3),
        right_ear=round(right_ear, 3),
        is_blinking=avg_ear < EAR_BLINK_THRESHOLD,
        avg_ear=round(avg_ear, 3),
    )


# ── Head Pose Estimation ──

# Key facial landmarks for pose estimation
NOSE_TIP = 1
CHIN = 152
LEFT_EYE_CORNER = 263
RIGHT_EYE_CORNER = 33
LEFT_MOUTH = 287
RIGHT_MOUTH = 57

HEAD_TURN_THRESHOLD = 15.0  # degrees


def estimate_head_pose(image_bytes: bytes) -> HeadPoseResult:
    """Estimate head yaw/pitch/roll from face landmarks."""
    img = _bytes_to_cv2(image_bytes)
    if img is None:
        return HeadPoseResult(0, 0, 0)

    h, w = img.shape[:2]
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    face_mesh = _get_face_mesh()
    results = face_mesh.process(rgb)

    if not results.multi_face_landmarks:
        return HeadPoseResult(0, 0, 0)

    landmarks = results.multi_face_landmarks[0].landmark

    # 2D image points
    image_points = np.array([
        (landmarks[NOSE_TIP].x * w, landmarks[NOSE_TIP].y * h),
        (landmarks[CHIN].x * w, landmarks[CHIN].y * h),
        (landmarks[LEFT_EYE_CORNER].x * w, landmarks[LEFT_EYE_CORNER].y * h),
        (landmarks[RIGHT_EYE_CORNER].x * w, landmarks[RIGHT_EYE_CORNER].y * h),
        (landmarks[LEFT_MOUTH].x * w, landmarks[LEFT_MOUTH].y * h),
        (landmarks[RIGHT_MOUTH].x * w, landmarks[RIGHT_MOUTH].y * h),
    ], dtype=np.float64)

    # 3D model points (generic face model)
    model_points = np.array([
        (0.0, 0.0, 0.0),           # nose tip
        (0.0, -330.0, -65.0),      # chin
        (-225.0, 170.0, -135.0),   # left eye corner
        (225.0, 170.0, -135.0),    # right eye corner
        (-150.0, -150.0, -125.0),  # left mouth
        (150.0, -150.0, -125.0),   # right mouth
    ], dtype=np.float64)

    # Camera internals (approximate)
    focal_length = w
    camera_matrix = np.array([
        [focal_length, 0, w / 2],
        [0, focal_length, h / 2],
        [0, 0, 1],
    ], dtype=np.float64)
    dist_coeffs = np.zeros((4, 1))

    success, rotation_vec, translation_vec = cv2.solvePnP(
        model_points, image_points, camera_matrix, dist_coeffs
    )

    if not success:
        return HeadPoseResult(0, 0, 0)

    rotation_mat, _ = cv2.Rodrigues(rotation_vec)
    angles, _, _, _, _, _ = cv2.RQDecomp3x3(rotation_mat)

    # angles[0] = pitch (up/down), angles[1] = yaw (left/right), angles[2] = roll
    return HeadPoseResult(
        yaw=round(float(angles[1]), 1),
        pitch=round(float(angles[0]), 1),
        roll=round(float(angles[2]), 1),
    )


# ── Anti-Spoofing (Texture Analysis) ──

def anti_spoof_check(image_bytes: bytes) -> float:
    """
    Basic anti-spoofing using texture analysis (LBP variance).

    Printed photos and screens have different texture characteristics
    than real faces (smoother, less micro-texture variation).

    Returns score 0-1.0 (higher = more likely real face).
    """
    img = _bytes_to_cv2(image_bytes)
    if img is None:
        return 0.0

    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Detect face region
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(60, 60))
        if len(faces) == 0:
            return 0.0

        # Use largest face
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        face_roi = gray[y:y + h, x:x + w]

        # Resize for consistent analysis
        face_roi = cv2.resize(face_roi, (128, 128))

        # Feature 1: Laplacian variance (real faces have more texture detail)
        laplacian_var = cv2.Laplacian(face_roi, cv2.CV_64F).var()

        # Feature 2: Local Binary Pattern variance
        # Simplified: use gradient magnitude variance
        gx = cv2.Sobel(face_roi, cv2.CV_64F, 1, 0, ksize=3)
        gy = cv2.Sobel(face_roi, cv2.CV_64F, 0, 1, ksize=3)
        gradient_mag = np.sqrt(gx ** 2 + gy ** 2)
        gradient_var = gradient_mag.var()

        # Feature 3: Color distribution analysis (on original color image)
        face_color = img[y:y + h, x:x + w]
        face_color = cv2.resize(face_color, (128, 128))
        hsv = cv2.cvtColor(face_color, cv2.COLOR_BGR2HSV)
        saturation_std = hsv[:, :, 1].std()

        # Scoring: real faces have higher texture variance and color diversity
        # These thresholds are empirically tuned
        score = 0.0

        if laplacian_var > 100:
            score += 0.35
        elif laplacian_var > 50:
            score += 0.20

        if gradient_var > 500:
            score += 0.35
        elif gradient_var > 200:
            score += 0.20

        if saturation_std > 20:
            score += 0.30
        elif saturation_std > 10:
            score += 0.15

        return min(score, 1.0)

    except Exception as e:
        logger.error("Anti-spoof check failed: %s", e)
        return 0.0


# ── Main Liveness Adapter ──

class LivenessAdvancedAdapter:
    """
    Advanced liveness detection combining:
    1. Active challenges (blink, head turn) via MediaPipe
    2. Anti-spoofing via texture analysis
    """

    def __init__(self, anti_spoof_threshold: float = 0.5):
        self.anti_spoof_threshold = anti_spoof_threshold

    def check_blink(self, image_bytes: bytes) -> BlinkResult:
        """Check if the person is blinking in this frame."""
        return detect_blink(image_bytes)

    def check_head_pose(self, image_bytes: bytes) -> HeadPoseResult:
        """Estimate head orientation."""
        return estimate_head_pose(image_bytes)

    def check_anti_spoof(self, image_bytes: bytes) -> float:
        """Check if the face is real (not a photo/screen). Returns 0-1.0."""
        return anti_spoof_check(image_bytes)

    def check_liveness(
        self,
        frames: list[bytes],
        require_blink: bool = True,
        require_head_turn: bool = True,
    ) -> LivenessCheckResult:
        """
        Analyze multiple frames for liveness signals.

        For basic verification: just anti-spoofing on selfie frame.
        For advanced verification: blink + head turn challenges + anti-spoofing.
        """
        if not frames:
            return LivenessCheckResult(is_live=False, confidence=0, anti_spoof_score=0)

        challenges_passed = []
        challenges_failed = []
        details = {}

        # Anti-spoofing on all frames
        spoof_scores = [anti_spoof_check(f) for f in frames]
        avg_spoof = sum(spoof_scores) / len(spoof_scores)
        details["anti_spoof_scores"] = [round(s, 2) for s in spoof_scores]
        details["avg_anti_spoof"] = round(avg_spoof, 2)

        if avg_spoof < self.anti_spoof_threshold:
            challenges_failed.append("anti_spoofing")
            return LivenessCheckResult(
                is_live=False,
                confidence=avg_spoof,
                anti_spoof_score=avg_spoof,
                challenges_failed=["anti_spoofing"],
                details=details,
            )
        challenges_passed.append("anti_spoofing")

        # Blink detection (need at least one frame with eyes closed)
        if require_blink:
            blinks = [detect_blink(f) for f in frames]
            any_blink = any(b.is_blinking for b in blinks)
            any_open = any(not b.is_blinking and b.avg_ear > 0.25 for b in blinks)
            details["blink_ears"] = [b.avg_ear for b in blinks]

            if any_blink and any_open:
                challenges_passed.append("blink")
            else:
                challenges_failed.append("blink")

        # Head turn detection (need yaw variation across frames)
        if require_head_turn:
            poses = [estimate_head_pose(f) for f in frames]
            yaws = [p.yaw for p in poses]
            yaw_range = max(yaws) - min(yaws) if yaws else 0
            details["head_yaws"] = yaws
            details["yaw_range"] = round(yaw_range, 1)

            if yaw_range >= HEAD_TURN_THRESHOLD:
                challenges_passed.append("head_turn")
            else:
                challenges_failed.append("head_turn")

        # Calculate overall confidence
        total_checks = len(challenges_passed) + len(challenges_failed)
        confidence = len(challenges_passed) / total_checks if total_checks > 0 else 0

        return LivenessCheckResult(
            is_live=len(challenges_failed) == 0,
            confidence=round(confidence, 2),
            anti_spoof_score=round(avg_spoof, 2),
            challenges_passed=challenges_passed,
            challenges_failed=challenges_failed,
            details=details,
        )

    def quick_liveness(self, selfie_bytes: bytes) -> LivenessCheckResult:
        """
        Quick liveness check on a single selfie frame.
        Only runs anti-spoofing (no active challenges).
        Used for basic verification level.
        """
        score = anti_spoof_check(selfie_bytes)
        passed = score >= self.anti_spoof_threshold

        return LivenessCheckResult(
            is_live=passed,
            confidence=score,
            anti_spoof_score=score,
            challenges_passed=["anti_spoofing"] if passed else [],
            challenges_failed=[] if passed else ["anti_spoofing"],
            details={"mode": "quick", "score": round(score, 2)},
        )
