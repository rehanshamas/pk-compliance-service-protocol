"""Case API schemas."""

from pydantic import BaseModel, Field


VALID_STATUSES = frozenset(
    {"open", "investigating", "escalated", "closed_no_action", "closed_str_filed"}
)


class CaseCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=256)
    description: str | None = None
    alertId: str | None = None
    assignedTo: str | None = None


class CasePatchRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=256)
    description: str | None = None
    status: str | None = None
    assignedTo: str | None = None


class CaseResponse(BaseModel):
    id: str
    tenantId: str
    title: str
    description: str | None
    status: str
    linkedAlertsCount: int
    assignedTo: str | None
    createdAt: str
    updatedAt: str


class CaseListResponse(BaseModel):
    items: list[CaseResponse]
    total: int


class CaseNoteCreateRequest(BaseModel):
    content: str = Field(..., min_length=1)


class CaseNoteResponse(BaseModel):
    id: str
    caseId: str
    userId: str
    content: str
    createdAt: str


# --- ISAR (Form A7, Phase 5.2 / WS-6) ---
# Form A7 has 5 sections:
#   1. Reporter Details
#   2. Customer Details
#   3. Transaction Details
#   4. Suspicion Narrative
#   5. MLRO Determination


class IsarReporterDetails(BaseModel):
    """Section 1: Reporter Details."""
    reporterName: str | None = Field(None, max_length=255, description="Name of the person filing the ISAR")
    reporterPosition: str | None = Field(None, max_length=128, description="Position/title of reporter")
    reportDate: str | None = Field(None, description="Date of report (ISO format)")


class IsarCustomerDetails(BaseModel):
    """Section 2: Customer Details."""
    customerName: str | None = Field(None, max_length=255, description="Customer full name")
    customerId: str | None = Field(None, description="Customer ID / reference")
    walletAddresses: list[str] | None = Field(None, description="Associated wallet/blockchain addresses")
    accountNumbers: list[str] | None = Field(None, description="Associated account numbers")


class IsarTransactionDetails(BaseModel):
    """Section 3: Transaction Details."""
    transactionDates: list[str] | None = Field(None, description="Dates of suspicious transactions (ISO format)")
    amounts: list[str] | None = Field(None, description="Transaction amounts with currency")
    transactionType: str | None = Field(None, max_length=128, description="Type of transaction (e.g., transfer, withdrawal)")
    onChainDetails: str | None = Field(None, description="On-chain transaction details (TX hashes, chain)")
    offChainDetails: str | None = Field(None, description="Off-chain transaction details")


class IsarMlroDetermination(BaseModel):
    """Section 5: MLRO Determination."""
    determination: str | None = Field(
        None,
        description="file_str | do_not_file | additional_info_required",
    )
    determinationNotes: str | None = Field(None, max_length=2000, description="MLRO notes / rationale")
    mlroName: str | None = Field(None, max_length=255)
    mlroSignatureDate: str | None = Field(None, description="Date MLRO signed (ISO format)")


class IsarCreateRequest(BaseModel):
    """POST /isars — create ISAR draft (Form A7 with all 5 sections)."""

    caseId: str | None = Field(None, description="Case ID (optional — auto-creates case if not provided)")
    subjectCustomerId: str = Field(..., description="Subject customer ID")
    suspicionType: str = Field(..., min_length=1, max_length=128)
    narrative: str = Field(..., min_length=1, description="Section 4: Suspicion narrative — facts, behaviour, indicators, red flags")
    supportingEvidence: dict | None = Field(None, description="JSON object of supporting evidence")

    # Form A7 structured sections
    reporterDetails: IsarReporterDetails | None = Field(None, description="Section 1: Reporter Details")
    customerDetails: IsarCustomerDetails | None = Field(None, description="Section 2: Customer Details")
    transactionDetails: IsarTransactionDetails | None = Field(None, description="Section 3: Transaction Details")
    mlroDetermination: IsarMlroDetermination | None = Field(None, description="Section 5: MLRO Determination")


class IsarUpdateRequest(BaseModel):
    """PATCH /isars/{id} — update ISAR draft fields."""

    suspicionType: str | None = Field(None, min_length=1, max_length=128)
    narrative: str | None = Field(None, min_length=1)
    supportingEvidence: dict | None = None
    reporterDetails: IsarReporterDetails | None = None
    customerDetails: IsarCustomerDetails | None = None
    transactionDetails: IsarTransactionDetails | None = None
    mlroDetermination: IsarMlroDetermination | None = None


class IsarResponse(BaseModel):
    """ISAR detail response (Form A7 with all 5 sections)."""

    id: str
    tenantId: str
    caseId: str | None
    subjectCustomerId: str
    suspicionType: str
    narrative: str
    supportingEvidence: dict | None
    status: str
    submittedBy: str | None
    reviewedBy: str | None
    approvedBy: str | None
    createdAt: str
    approvedAt: str | None
    filedAt: str | None
    rejectionRationale: str | None

    # Form A7 structured sections
    reporterDetails: dict | None = None
    customerDetails: dict | None = None
    transactionDetails: dict | None = None
    mlroDetermination: dict | None = None


class IsarListResponse(BaseModel):
    """GET /isars — paginated list."""

    items: list[IsarResponse]
    total: int


class IsarApproveRequest(BaseModel):
    """POST /isars/{id}/approve — MLRO approval."""

    notes: str | None = Field(None, max_length=1000)
    determination: str | None = Field(None, description="file_str | do_not_file | additional_info_required")
    mlroName: str | None = Field(None, max_length=255)


class IsarRejectRequest(BaseModel):
    """POST /isars/{id}/reject — MLRO rejection. Rationale required."""

    rejectionRationale: str = Field(..., min_length=1, max_length=2000)


# --- STR/CTR Reports (Phase 5.3) ---


class StrReportResponse(BaseModel):
    """STR/CTR report metadata."""

    id: str
    tenantId: str
    isarId: str
    reportType: str
    goamlSchemaVersion: str
    filingStatus: str
    createdAt: str


class StrReportListResponse(BaseModel):
    """GET /reports/str — paginated list."""

    items: list[StrReportResponse]
    total: int


class StrReportGenerateRequest(BaseModel):
    """POST /reports/str/generate — generate STR from ISAR."""

    isarId: str = Field(..., description="ISAR ID (must be approved or filed_as_str)")
    schemaVersion: str = Field("5.0.2", max_length=32)
