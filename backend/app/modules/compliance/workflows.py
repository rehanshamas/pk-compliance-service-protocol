"""Compliance workflow validations: case status transitions, ISAR actions.

Ensures no improper actions can be performed out of order.
"""

from app.modules.compliance.models import CaseStatus, IsarStatus


# Valid case transitions: from_status -> set of allowed to_status
CASE_TRANSITIONS: dict[CaseStatus, set[CaseStatus]] = {
    CaseStatus.open: {CaseStatus.investigating, CaseStatus.escalated},
    CaseStatus.investigating: {
        CaseStatus.escalated,
        CaseStatus.closed_no_action,
        CaseStatus.closed_str_filed,
    },
    CaseStatus.escalated: {
        CaseStatus.closed_no_action,
        CaseStatus.closed_str_filed,
    },
    CaseStatus.closed_no_action: {CaseStatus.open},  # Reopen if new evidence (MLRO only)
    CaseStatus.closed_str_filed: set(),  # Terminal
}


def can_transition_case(from_status: CaseStatus, to_status: CaseStatus) -> bool:
    """Check if case transition from_status -> to_status is allowed."""
    if from_status == to_status:
        return True
    allowed = CASE_TRANSITIONS.get(from_status, set())
    return to_status in allowed


def validate_case_transition(from_status: CaseStatus, to_status: CaseStatus) -> None:
    """Raise ValidationError if case transition is invalid."""
    from app.core.exceptions import ValidationError

    if not can_transition_case(from_status, to_status):
        if from_status in (CaseStatus.closed_no_action, CaseStatus.closed_str_filed):
            raise ValidationError(
                "Cannot change status of a closed case. Closed cases are final.",
                details={"from_status": from_status.value, "to_status": to_status.value},
            )
        raise ValidationError(
            f"Invalid case status transition: {from_status.value} → {to_status.value}. "
            f"From '{from_status.value}' you can only move to: "
            f"{', '.join(s.value for s in CASE_TRANSITIONS.get(from_status, set()))}.",
            details={"from_status": from_status.value, "to_status": to_status.value},
        )


def get_allowed_case_transitions(from_status: CaseStatus) -> list[CaseStatus]:
    """Return list of statuses the case can transition to (for frontend)."""
    allowed = CASE_TRANSITIONS.get(from_status, set())
    return list(allowed)
