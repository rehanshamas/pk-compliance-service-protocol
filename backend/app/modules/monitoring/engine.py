"""Rules engine: evaluate monitoring rules against transaction events. Phase 6.6."""

from app.models.monitoring_rule import MonitoringRule


def evaluate_rule(rule: MonitoringRule, event: dict) -> bool:
    """
    Evaluate a single rule against a transaction event.

    Event dict may include: amount, currency, from_address, to_address,
    event_type, risk_flags, indicator_scores, etc.

    Returns True if the rule triggers (should create alert).
    """
    if not rule.enabled:
        return False

    cond = rule.conditions or {}
    rule_type = rule.rule_type.value

    if rule_type == "threshold":
        return _eval_threshold(cond, event)
    if rule_type == "velocity":
        return _eval_velocity(cond, event)
    if rule_type == "pattern":
        return _eval_pattern(cond, event)
    if rule_type in ("counterparty", "typology"):
        return _eval_pattern(cond, event)

    return False


def _eval_threshold(cond: dict, event: dict) -> bool:
    """Threshold: single-transaction amount checks."""
    amount = event.get("amount")
    if amount is None:
        return False

    currency = cond.get("currency")
    if currency and event.get("currency") != currency:
        return False

    if "amount_gt" in cond and amount > cond["amount_gt"]:
        return True
    if "amount_gte" in cond and amount >= cond["amount_gte"]:
        return True
    if "amount_lt" in cond and amount < cond["amount_lt"]:
        return True
    if "amount_lte" in cond and amount <= cond["amount_lte"]:
        return True
    return False


def _eval_velocity(cond: dict, event: dict) -> bool:
    """
    Velocity: window-based count/volume. Requires aggregation context.

    For single-event evaluation we cannot run velocity rules; they need
    a pre-aggregated window (e.g. from a transaction_events query).
    The event dict can include pre-computed: window_count, window_amount_total.
    """
    window_count = event.get("window_count")
    window_amount = event.get("window_amount_total")

    if window_count is not None:
        if cond.get("count_gt") is not None and window_count > cond["count_gt"]:
            return True
        if cond.get("count_gte") is not None and window_count >= cond["count_gte"]:
            return True

    if window_amount is not None:
        if cond.get("amount_total_gt") is not None and window_amount > cond["amount_total_gt"]:
            return True
        if cond.get("amount_total_lt") is not None and window_amount < cond["amount_total_lt"]:
            return True

    return False


def _eval_pattern(cond: dict, event: dict) -> bool:
    """
    Pattern: indicator or typology with min_confidence.
    Uses risk_flags or indicator_scores from event.
    """
    indicator = cond.get("indicator") or cond.get("typology")
    min_conf = cond.get("min_confidence", 0.5)

    if not indicator:
        return False

    scores = event.get("indicator_scores") or {}
    confidence = scores.get(indicator)
    if confidence is None:
        risk_flags = event.get("risk_flags") or []
        if indicator in risk_flags:
            confidence = 0.7
        else:
            return False

    return confidence >= min_conf
