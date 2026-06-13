"""KYC Session request and response schemas."""

from pydantic import BaseModel, Field


class KycSessionCreate(BaseModel):
    """POST /kyc-sessions -- VASP creates a hosted KYC session."""

    external_ref: str | None = Field(None, max_length=255, description="VASP's internal user ID")
    customer_name: str | None = Field(None, max_length=255)
    customer_cnic: str | None = Field(None, max_length=20)
    customer_phone: str | None = Field(None, max_length=20)
    customer_dob: str | None = Field(None, max_length=10, description="YYYY-MM-DD")
    customer_nationality: str | None = Field(None, max_length=100)
    verification_level: str = Field("basic", pattern="^(basic|advanced)$", description="basic or advanced")
    upgrade_from_basic: bool = Field(False, description="If true, skips document capture for users who already completed basic KYC")
    web_callback_url: str | None = Field(None, max_length=1024, description="Redirect URL after completion (web)")
    mobile_callback_url: str | None = Field(None, max_length=1024, description="Deep link for mobile callback")


class KycSessionResponse(BaseModel):
    """Response for created/retrieved KYC session."""

    session_id: str
    status: str
    current_step: str
    kyc_status: str | None = None
    risk_tier: str | None = None
    customer_id: str | None = None
    liveness_required: bool = False
    web_url: str
    mobile_url: str
    expires_at: str
    completed_at: str | None = None
    created_at: str


class KycSessionStatusResponse(BaseModel):
    """GET /kyc-sessions/{session_id} -- status check for VASP."""

    session_id: str
    status: str
    current_step: str
    kyc_status: str | None = None
    risk_tier: str | None = None
    customer_id: str | None = None
    completed_at: str | None = None


class KycSessionVerifyResponse(BaseModel):
    """GET /kyc-sessions/{session_id}/verify -- public page data."""

    session_id: str
    status: str
    current_step: str
    liveness_required: bool
    is_upgrade: bool = False
    customer_name: str | None = None
    expires_at: str
    completed_at: str | None = None
    kyc_status: str | None = None
    risk_tier: str | None = None
    web_callback_url: str | None = None
    mobile_callback_url: str | None = None


class CompleteStepRequest(BaseModel):
    """POST /kyc-sessions/{session_id}/complete-step -- advance to next step."""

    step: str = Field(..., pattern="^(upload|verify|liveness|complete)$")
