/**
 * Case workflow: valid status transitions.
 * Must match backend app.modules.compliance.workflows.CASE_TRANSITIONS.
 */

export type CaseStatus =
  | "open"
  | "investigating"
  | "escalated"
  | "closed_no_action"
  | "closed_str_filed";

export const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  open: ["investigating", "escalated"],
  investigating: ["escalated", "closed_no_action", "closed_str_filed"],
  escalated: ["closed_no_action", "closed_str_filed"],
  closed_no_action: ["open"],  // Reopen if new evidence (MLRO only)
  closed_str_filed: [],
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  escalated: "Escalated",
  closed_no_action: "Closed (No Action)",
  closed_str_filed: "Closed (STR Filed)",
};

export function getAllowedNextStatuses(from: string): CaseStatus[] {
  return CASE_TRANSITIONS[from as CaseStatus] ?? [];
}

export function isCaseClosed(status: string): boolean {
  return status === "closed_no_action" || status === "closed_str_filed";
}

/** Workflow steps for timeline display */
export const CASE_WORKFLOW_STEPS: { status: CaseStatus; label: string; description: string }[] = [
  { status: "open", label: "Open", description: "Case created, awaiting assignment" },
  { status: "investigating", label: "Investigating", description: "Under review by compliance team" },
  { status: "escalated", label: "Escalated", description: "Escalated to MLRO for decision" },
  { status: "closed_no_action", label: "Closed (No Action)", description: "Closed without filing STR" },
  { status: "closed_str_filed", label: "Closed (STR Filed)", description: "STR filed with FMU" },
];

/** Helper text for next steps at each status */
export const CASE_NEXT_STEP_HELP: Record<CaseStatus, string> = {
  open: "Link alerts and customers, then move to Investigating to begin review.",
  investigating:
    "Add investigation notes. Escalate to MLRO if STR filing is needed, or close with no action.",
  escalated:
    "MLRO reviews and decides: close with no action, or create ISAR and file as STR.",
  closed_no_action:
    "Case is closed. MLRO can reopen if new evidence emerges.",
  closed_str_filed:
    "STR filed. Download XML from Reports → STR/CTR and submit to goAML portal.",
};
