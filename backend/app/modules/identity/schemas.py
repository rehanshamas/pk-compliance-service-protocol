"""Identity/KYC request and response schemas."""

from uuid import UUID

from pydantic import BaseModel, Field


class CustomerCreate(BaseModel):
    """POST /customers — create customer, start KYC."""

    external_ref: str | None = Field(None, max_length=255, description="VASP's internal customer ID")
    full_name: str = Field(..., min_length=1, max_length=255)
    dob: str | None = Field(None, max_length=50, description="Date of birth (YYYY-MM-DD or partial)")
    nationality: str | None = Field(None, max_length=100)
    cnic_number: str | None = Field(None, max_length=20, description="Pakistan CNIC (35201-1234567-1)")
    phone: str | None = Field(None, max_length=20, description="Phone number")
    business_purpose: str | None = Field(None, max_length=512, description="Nature and purpose of business relationship (Reg. 9.2(c))")
    expected_activity: str | None = Field(None, max_length=512, description="Expected transaction profile")


class CustomerUpdate(BaseModel):
    """PATCH /customers/{id} — partial update."""

    external_ref: str | None = Field(None, max_length=255)
    full_name: str | None = Field(None, min_length=1, max_length=255)
    dob: str | None = Field(None, max_length=50)
    nationality: str | None = Field(None, max_length=100)
    cnic_number: str | None = Field(None, max_length=20)
    phone: str | None = Field(None, max_length=20, description="Phone number")
    business_purpose: str | None = Field(None, max_length=512, description="Nature and purpose of business relationship (Reg. 9.2(c))")
    expected_activity: str | None = Field(None, max_length=512, description="Expected transaction profile")
    risk_tier: str | None = Field(None, pattern="^(low|medium|high|prohibited)$")
    kyc_status: str | None = Field(
        None,
        pattern="^(initiated|documents_uploaded|identity_verified|liveness_checked|risk_scored|approved|rejected|edd_required|edd_in_progress|frozen)$",
    )


class CustomerResponse(BaseModel):
    """Single customer (list item or detail)."""

    id: str
    tenantId: str
    externalRef: str | None
    fullName: str
    dob: str | None
    nationality: str | None
    cnicNumber: str | None
    phone: str | None = None
    businessPurpose: str | None = None
    expectedActivity: str | None = None
    riskTier: str
    kycStatus: str
    createdAt: str
    updatedAt: str


# Alias for router
CustomerDetail = CustomerResponse


class CustomerListResponse(BaseModel):
    """GET /customers — paginated list."""

    items: list[CustomerResponse]
    total: int


class DocumentDetail(BaseModel):
    """Identity document response (Phase 4.3)."""

    id: str
    customerId: str
    documentType: str
    fileKey: str
    contentType: str
    fileSizeBytes: int
    ocrData: dict | None = None
    createdAt: str


class DocumentListResponse(BaseModel):
    """GET /customers/{id}/documents — list documents."""

    items: list[DocumentDetail]


class VerificationResultDetail(BaseModel):
    """Verification result (OCR, face match, liveness, NADRA)."""

    id: str
    customerId: str
    verificationType: str
    provider: str
    status: str
    confidenceScore: float | None
    rawResponse: dict | None = None
    createdAt: str


class ShuftiPendingDetail(BaseModel):
    """Shufti e-IDV Pro pending verification. User must complete at verificationUrl."""

    status: str = "pending"
    verificationUrl: str
    reference: str
    customerId: str


class VerificationResultListResponse(BaseModel):
    """GET /customers/{id}/verification-results — list verification results."""

    items: list[VerificationResultDetail]


class RunKycResponse(BaseModel):
    """POST /customers/{id}/run-kyc — CDD orchestrator result."""

    customer: CustomerResponse
    stepsRun: list[str]
    message: str


# --- EDD (Phase 4.10) ---


class EddCaseDetail(BaseModel):
    """GET /customers/{id}/edd — EDD case detail."""

    id: str
    customerId: str
    sourceOfFunds: str | None = None
    sourceOfFundsVerified: bool = False
    approvalStatus: str
    approvedBy: str | None = None
    approvedAt: str | None = None
    approvalNotes: str | None = None
    createdAt: str
    updatedAt: str


class EddSubmitSourceOfFunds(BaseModel):
    """PATCH /customers/{id}/edd — submit source of funds."""

    source_of_funds: str = Field(..., min_length=1, max_length=2000)
    source_of_funds_verified: bool = False


class EddApproveRequest(BaseModel):
    """POST /customers/{id}/edd/approve — senior approval."""

    notes: str | None = Field(None, max_length=1000)


class EddRejectRequest(BaseModel):
    """POST /customers/{id}/edd/reject — senior rejection."""

    notes: str = Field(..., min_length=1, max_length=1000, description="Rejection rationale required")


# --- Asset Freeze (PVARA Reg. 12.2) ---


class FreezeRequest(BaseModel):
    """POST /customers/{id}/freeze — initiate asset freeze."""

    screening_result_id: str | None = Field(None, description="Screening result that triggered freeze")
    alert_id: str | None = Field(None, description="Related alert ID")
    freeze_type: str = Field(..., pattern="^(tfs_sanctions|nacta|un|court_order)$")
    matched_list: str | None = Field(None, max_length=50, description="UN, NACTA, OFAC, EU")
    matched_name: str | None = Field(None, max_length=500, description="Name matched on sanctions list")
    match_score: float | None = Field(None, ge=0, le=100)
    notes: str | None = Field(None, max_length=2000)


class UnfreezeRequest(BaseModel):
    """POST /customers/{id}/unfreeze — remove asset freeze."""

    reason: str = Field(..., pattern="^(fmu_order|court_order|false_positive_confirmed)$")
    notes: str | None = Field(None, max_length=2000)


class FreezeRecordDetail(BaseModel):
    """Freeze record response."""

    id: str
    tenantId: str
    customerId: str
    screeningResultId: str | None = None
    alertId: str | None = None
    freezeType: str
    matchedList: str | None = None
    matchedName: str | None = None
    matchScore: float | None = None
    status: str
    frozenAt: str
    reportedToFmuAt: str | None = None
    unfrozenAt: str | None = None
    unfreezeReason: str | None = None
    frozenBy: str | None = None
    notes: str | None = None
    createdAt: str
    updatedAt: str


class FreezeRecordListResponse(BaseModel):
    """List of freeze records."""

    items: list[FreezeRecordDetail]
    total: int
