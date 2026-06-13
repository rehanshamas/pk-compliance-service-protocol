"""Screening request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ScreeningCheckRequest(BaseModel):
    """POST /screening/check — real-time name screening."""

    name: str = Field(..., min_length=1, max_length=500)
    dob: str | None = Field(None, max_length=50)
    id_number: str | None = Field(None, max_length=100)


class MatchItemSchema(BaseModel):
    watchlist_entry_id: str
    score: float
    matched_fields: list[str]


class ScreeningCheckResponse(BaseModel):
    id: str
    screenedEntityName: str
    matches: list[dict]  # [{watchlistEntryId, score}, ...]
    overallStatus: str
    createdAt: str


class ScreeningResultDetail(BaseModel):
    """Single screening result (list item or detail)."""
    id: str
    screenedEntityName: str
    source: str | None = None
    matchScore: float | None = None
    dispositionStatus: str = "pending"
    createdAt: str
    matches: list | None = None  # full match data for detail view


class ScreeningResultListResponse(BaseModel):
    items: list[ScreeningResultDetail]
    total: int


class DispositionRequest(BaseModel):
    """POST /screening/dispositions — disposition a match."""

    screening_result_id: UUID
    disposition: str = Field(..., pattern="^(true_positive|false_positive|escalated)$")
    rationale: str | None = Field(None, max_length=2000)


class IngestionHealthResponse(BaseModel):
    source: str
    last_run_at: datetime | None
    records_count: int
    status: str
    last_error: str | None


# --- Batch screening ---

class BatchRowInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=500)
    dob: str | None = Field(None, max_length=50)
    id_number: str | None = Field(None, max_length=100)


class BatchSubmitRequest(BaseModel):
    """POST /screening/batch — submit batch rows (alternative to CSV upload)."""
    rows: list[BatchRowInput] = Field(..., min_length=1, max_length=5000)


class BatchJobResponse(BaseModel):
    id: str
    tenantId: str
    recordsCount: int
    status: str
    progressPercent: int
    processedCount: int
    startedAt: str | None
    completedAt: str | None
    errorMessage: str | None
    downloadUrl: str | None = None
