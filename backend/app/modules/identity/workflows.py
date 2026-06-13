"""KYC state machine (4.2). Valid transitions enforced, invalid rejected."""

from app.modules.identity.models import KycStatus

# Valid transitions: from_status -> set of allowed to_status
KYC_TRANSITIONS: dict[KycStatus, set[KycStatus]] = {
    KycStatus.initiated: {KycStatus.documents_uploaded, KycStatus.rejected},
    KycStatus.documents_uploaded: {KycStatus.identity_verified, KycStatus.rejected},
    KycStatus.identity_verified: {KycStatus.liveness_checked, KycStatus.rejected},
    KycStatus.liveness_checked: {KycStatus.risk_scored, KycStatus.rejected},
    KycStatus.risk_scored: {KycStatus.approved, KycStatus.rejected, KycStatus.edd_required},
    KycStatus.edd_required: {KycStatus.edd_in_progress, KycStatus.rejected},
    KycStatus.edd_in_progress: {KycStatus.approved, KycStatus.rejected},
    KycStatus.approved: set(),  # Terminal
    KycStatus.rejected: set(),  # Terminal
}


def can_transition(from_status: KycStatus, to_status: KycStatus) -> bool:
    """Check if transition from_status -> to_status is allowed."""
    if from_status == to_status:
        return True
    allowed = KYC_TRANSITIONS.get(from_status, set())
    return to_status in allowed


def validate_transition(from_status: KycStatus, to_status: KycStatus) -> None:
    """Raise ValidationError if transition is invalid."""
    if not can_transition(from_status, to_status):
        from app.core.exceptions import ValidationError

        raise ValidationError(
            f"Invalid KYC transition: {from_status.value} -> {to_status.value}",
            details={"from_status": from_status.value, "to_status": to_status.value},
        )
