"""Tenant request/response schemas."""

from uuid import UUID

from pydantic import BaseModel


class TenantResponse(BaseModel):
    id: str
    name: str
    slug: str
    status: str
    feature_flags: dict
    outsourcingRegister: list | None = None  # Phase 5.4: Form A5 register

    class Config:
        from_attributes = True


class TenantPatchRequest(BaseModel):
    """PATCH /tenants/me — update tenant config (e.g. outsourcing register)."""

    outsourcingRegister: list | None = None
