"""Alert API schemas."""

from pydantic import BaseModel


class AlertResponse(BaseModel):
    id: str
    tenantId: str
    severity: str
    source: str
    summary: str
    status: str
    assignedTo: str | None
    sourceId: str
    createdAt: str
    resolvedAt: str | None


class AlertListResponse(BaseModel):
    items: list[AlertResponse]
    total: int


class AlertPatchRequest(BaseModel):
    status: str | None = None
    assignedTo: str | None = None
