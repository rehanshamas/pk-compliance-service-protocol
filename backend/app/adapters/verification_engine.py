"""KYC Verification Engine — orchestrates all adapters into a unified verification pipeline.

Two verification levels:
- Basic: document OCR + face match + phone OTP
- Advanced: Basic + active liveness + document-in-hand

All ML processing happens here. SDKs and hosted page send frames,
this engine processes and returns results per step.
"""

import logging
from dataclasses import dataclass, field
from enum import Enum

from .easyocr_adapter import EasyOcrAdapter, CnicExtraction
from .face_enhanced import FaceEnhancedAdapter, FaceMatchResult, FaceCropResult
from .liveness_advanced import LivenessAdvancedAdapter, LivenessCheckResult
from .document_hand import DocumentInHandDetector, DocumentInHandResult
from .image_quality import ImageQualityChecker, QualityResult

logger = logging.getLogger(__name__)


class VerificationLevel(str, Enum):
    BASIC = "basic"
    ADVANCED = "advanced"


class VerificationStep(str, Enum):
    DOCUMENT_FRONT = "document_front"
    DOCUMENT_BACK = "document_back"
    SELFIE = "selfie"
    LIVENESS = "liveness"
    DOCUMENT_IN_HAND = "document_in_hand"


@dataclass
class StepResult:
    """Result of processing a single verification step."""

    step: str
    passed: bool
    data: dict = field(default_factory=dict)
    quality: QualityResult | None = None
    errors: list[str] = field(default_factory=list)


@dataclass
class VerificationState:
    """Tracks the state of a verification session across multiple steps."""

    level: VerificationLevel
    steps_completed: list[str] = field(default_factory=list)
    steps_required: list[str] = field(default_factory=list)

    # Stored data from each step
    cnic_front_data: CnicExtraction | None = None
    cnic_back_data: CnicExtraction | None = None
    document_face_crop: bytes | None = None
    selfie_bytes: bytes | None = None
    face_match_result: FaceMatchResult | None = None
    liveness_result: LivenessCheckResult | None = None
    document_in_hand_result: DocumentInHandResult | None = None

    # Overall
    is_complete: bool = False
    overall_passed: bool = False

    def get_required_steps(self) -> list[str]:
        if self.level == VerificationLevel.BASIC:
            return [
                VerificationStep.DOCUMENT_FRONT,
                VerificationStep.DOCUMENT_BACK,
                VerificationStep.SELFIE,
            ]
        else:
            return [
                VerificationStep.DOCUMENT_FRONT,
                VerificationStep.DOCUMENT_BACK,
                VerificationStep.SELFIE,
                VerificationStep.LIVENESS,
                VerificationStep.DOCUMENT_IN_HAND,
            ]

    def get_next_step(self) -> str | None:
        required = self.get_required_steps()
        for step in required:
            if step not in self.steps_completed:
                return step
        return None

    def check_complete(self) -> bool:
        required = set(self.get_required_steps())
        completed = set(self.steps_completed)
        self.is_complete = required.issubset(completed)
        if self.is_complete:
            self.overall_passed = all(
                step in self.steps_completed for step in required
            )
        return self.is_complete


class VerificationEngine:
    """
    Orchestrates the KYC verification pipeline.

    Usage:
        engine = VerificationEngine()
        state = engine.create_session(VerificationLevel.BASIC)

        result = engine.process_step(state, "document_front", image_bytes)
        result = engine.process_step(state, "selfie", image_bytes)
        ...
    """

    def __init__(
        self,
        face_match_threshold: float = 0.55,
        anti_spoof_threshold: float = 0.5,
        face_model: str = "ArcFace",
    ):
        self.ocr = EasyOcrAdapter()
        self.face = FaceEnhancedAdapter(model_name=face_model, distance_threshold=face_match_threshold)
        self.liveness = LivenessAdvancedAdapter(anti_spoof_threshold=anti_spoof_threshold)
        self.doc_hand = DocumentInHandDetector()
        self.quality = ImageQualityChecker()

    def create_session(self, level: VerificationLevel) -> VerificationState:
        """Create a new verification session."""
        state = VerificationState(level=level)
        state.steps_required = state.get_required_steps()
        return state

    def process_step(
        self,
        state: VerificationState,
        step: str,
        image_bytes: bytes,
        extra_frames: list[bytes] | None = None,
    ) -> StepResult:
        """
        Process a single verification step.

        Args:
            state: current verification state (mutated in place)
            step: which step to process
            image_bytes: primary image for this step
            extra_frames: additional frames (for liveness: blink + head turn sequence)

        Returns:
            StepResult with pass/fail and extracted data
        """
        logger.info("Processing step: %s (level: %s)", step, state.level)

        if step == VerificationStep.DOCUMENT_FRONT:
            return self._process_document_front(state, image_bytes)
        elif step == VerificationStep.DOCUMENT_BACK:
            return self._process_document_back(state, image_bytes)
        elif step == VerificationStep.SELFIE:
            return self._process_selfie(state, image_bytes)
        elif step == VerificationStep.LIVENESS:
            frames = [image_bytes] + (extra_frames or [])
            return self._process_liveness(state, frames)
        elif step == VerificationStep.DOCUMENT_IN_HAND:
            return self._process_document_in_hand(state, image_bytes)
        else:
            return StepResult(step=step, passed=False, errors=[f"Unknown step: {step}"])

    # ── Step Processors ──

    def _process_document_front(self, state: VerificationState, image_bytes: bytes) -> StepResult:
        """Process CNIC front capture: quality check + OCR + face extraction."""
        errors = []

        # Quality check
        quality = self.quality.check_document(image_bytes)
        if not quality.passed:
            return StepResult(
                step=VerificationStep.DOCUMENT_FRONT,
                passed=False,
                quality=quality,
                errors=[i.message for i in quality.issues if i.severity == "error"],
            )

        # OCR extraction
        extraction = self.ocr.extract_cnic_front(image_bytes)
        state.cnic_front_data = extraction

        # Extract face from document photo
        face_crop = self.face.extract_face_from_document(image_bytes)
        if face_crop.found and face_crop.face_bytes:
            state.document_face_crop = face_crop.face_bytes

        # Validate minimum data extracted
        if not extraction.cnic_number and not extraction.full_name:
            errors.append("Could not read CNIC details. Please ensure the document is clear and well-lit.")

        passed = len(errors) == 0
        if passed:
            state.steps_completed.append(VerificationStep.DOCUMENT_FRONT)

        return StepResult(
            step=VerificationStep.DOCUMENT_FRONT,
            passed=passed,
            data={
                "full_name": extraction.full_name,
                "cnic_number": extraction.cnic_number,
                "date_of_birth": extraction.date_of_birth,
                "gender": extraction.gender,
                "father_husband_name": extraction.father_husband_name,
                "date_of_expiry": extraction.date_of_expiry,
                "ocr_confidence": round(extraction.confidence, 2),
                "face_found_in_document": face_crop.found,
            },
            quality=quality,
            errors=errors,
        )

    def _process_document_back(self, state: VerificationState, image_bytes: bytes) -> StepResult:
        """Process CNIC back capture: quality check + OCR for address."""
        errors = []

        quality = self.quality.check_document(image_bytes)
        if not quality.passed:
            return StepResult(
                step=VerificationStep.DOCUMENT_BACK,
                passed=False,
                quality=quality,
                errors=[i.message for i in quality.issues if i.severity == "error"],
            )

        extraction = self.ocr.extract_cnic_back(image_bytes)
        state.cnic_back_data = extraction

        passed = True  # Back is less strict — address extraction is best-effort
        state.steps_completed.append(VerificationStep.DOCUMENT_BACK)

        return StepResult(
            step=VerificationStep.DOCUMENT_BACK,
            passed=passed,
            data={
                "address": extraction.address,
                "cnic_number": extraction.cnic_number,  # cross-check with front
                "date_of_expiry": extraction.date_of_expiry,
                "ocr_confidence": round(extraction.confidence, 2),
            },
            quality=quality,
            errors=errors,
        )

    def _process_selfie(self, state: VerificationState, image_bytes: bytes) -> StepResult:
        """Process selfie: quality check + face match against document photo."""
        errors = []

        quality = self.quality.check_selfie(image_bytes)
        if not quality.passed:
            return StepResult(
                step=VerificationStep.SELFIE,
                passed=False,
                quality=quality,
                errors=[i.message for i in quality.issues if i.severity == "error"],
            )

        state.selfie_bytes = image_bytes

        # Face match against document
        if state.document_face_crop:
            match_result = self.face.match_faces(state.document_face_crop, image_bytes)
            state.face_match_result = match_result

            if not match_result.verified:
                errors.append(
                    f"Face does not match the document photo (similarity: {match_result.similarity_score}%). "
                    "Please ensure good lighting and face the camera directly."
                )
        else:
            errors.append("No face was found in the document. Please recapture the document front.")

        # Quick anti-spoof on selfie (basic level gets this for free)
        spoof_result = self.liveness.quick_liveness(image_bytes)
        if not spoof_result.is_live:
            errors.append("Liveness check failed. Please use a real camera, not a photo of a photo.")

        passed = len(errors) == 0
        if passed:
            state.steps_completed.append(VerificationStep.SELFIE)

        return StepResult(
            step=VerificationStep.SELFIE,
            passed=passed,
            data={
                "face_match_verified": state.face_match_result.verified if state.face_match_result else False,
                "face_match_score": state.face_match_result.similarity_score if state.face_match_result else 0,
                "anti_spoof_score": round(spoof_result.anti_spoof_score, 2),
                "anti_spoof_passed": spoof_result.is_live,
            },
            quality=quality,
            errors=errors,
        )

    def _process_liveness(self, state: VerificationState, frames: list[bytes]) -> StepResult:
        """Process liveness challenge: blink + head turn + anti-spoofing on multiple frames."""
        if len(frames) < 3:
            return StepResult(
                step=VerificationStep.LIVENESS,
                passed=False,
                errors=["Not enough frames for liveness verification. Please complete the challenges."],
            )

        result = self.liveness.check_liveness(
            frames,
            require_blink=True,
            require_head_turn=True,
        )
        state.liveness_result = result

        errors = []
        if not result.is_live:
            if "blink" in result.challenges_failed:
                errors.append("Blink not detected. Please blink naturally when prompted.")
            if "head_turn" in result.challenges_failed:
                errors.append("Head turn not detected. Please slowly turn your head when prompted.")
            if "anti_spoofing" in result.challenges_failed:
                errors.append("Liveness verification failed. Please ensure you are using a live camera.")

        passed = result.is_live
        if passed:
            state.steps_completed.append(VerificationStep.LIVENESS)

        return StepResult(
            step=VerificationStep.LIVENESS,
            passed=passed,
            data={
                "is_live": result.is_live,
                "confidence": result.confidence,
                "anti_spoof_score": result.anti_spoof_score,
                "challenges_passed": result.challenges_passed,
                "challenges_failed": result.challenges_failed,
            },
            errors=errors,
        )

    def _process_document_in_hand(self, state: VerificationState, image_bytes: bytes) -> StepResult:
        """Process document-in-hand: detect face + document in same frame."""
        errors = []

        # Check document-in-hand
        dih_result = self.doc_hand.check(image_bytes)
        state.document_in_hand_result = dih_result

        if not dih_result.both_present:
            if not dih_result.face_detected:
                errors.append("Face not detected. Please face the camera directly.")
            if not dih_result.document_detected:
                errors.append("Document not detected. Please hold your CNIC clearly visible next to your face.")
            if dih_result.face_detected and dih_result.document_detected:
                errors.append("Face and document overlap too much. Hold the document beside your face, not in front.")

        # Verify face in this frame matches the selfie
        if dih_result.face_detected and state.selfie_bytes:
            face_check = self.face.match_faces(state.selfie_bytes, image_bytes)
            if not face_check.verified:
                errors.append("Face in this frame doesn't match your selfie. Please try again.")

        # Anti-spoof on this frame too
        spoof_score = self.liveness.check_anti_spoof(image_bytes)
        if spoof_score < 0.4:
            errors.append("Liveness check failed on document-in-hand frame.")

        passed = len(errors) == 0 and dih_result.both_present
        if passed:
            state.steps_completed.append(VerificationStep.DOCUMENT_IN_HAND)

        # Check if session is now complete
        state.check_complete()

        return StepResult(
            step=VerificationStep.DOCUMENT_IN_HAND,
            passed=passed,
            data={
                "face_detected": dih_result.face_detected,
                "document_detected": dih_result.document_detected,
                "both_present": dih_result.both_present,
                "confidence": dih_result.confidence,
                "anti_spoof_score": round(spoof_score, 2),
            },
            errors=errors,
        )

    # ── Summary ──

    def get_summary(self, state: VerificationState) -> dict:
        """Get a summary of the verification session."""
        state.check_complete()

        summary = {
            "level": state.level.value,
            "is_complete": state.is_complete,
            "overall_passed": state.overall_passed,
            "steps_completed": state.steps_completed,
            "steps_remaining": [s for s in state.get_required_steps() if s not in state.steps_completed],
        }

        # Include extracted data
        if state.cnic_front_data:
            summary["cnic"] = {
                "full_name": state.cnic_front_data.full_name,
                "cnic_number": state.cnic_front_data.cnic_number,
                "date_of_birth": state.cnic_front_data.date_of_birth,
                "gender": state.cnic_front_data.gender,
                "father_husband_name": state.cnic_front_data.father_husband_name,
            }
        if state.cnic_back_data:
            summary.setdefault("cnic", {})["address"] = state.cnic_back_data.address
            summary.setdefault("cnic", {})["date_of_expiry"] = state.cnic_back_data.date_of_expiry

        if state.face_match_result:
            summary["face_match"] = {
                "verified": state.face_match_result.verified,
                "similarity_score": state.face_match_result.similarity_score,
            }

        if state.liveness_result:
            summary["liveness"] = {
                "is_live": state.liveness_result.is_live,
                "anti_spoof_score": state.liveness_result.anti_spoof_score,
                "challenges_passed": state.liveness_result.challenges_passed,
            }

        if state.document_in_hand_result:
            summary["document_in_hand"] = {
                "both_present": state.document_in_hand_result.both_present,
                "confidence": state.document_in_hand_result.confidence,
            }

        return summary
