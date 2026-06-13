"""Admin API schemas."""

from pydantic import BaseModel, Field


class PipelineHealthItem(BaseModel):
    source: str
    status: str
    lastRunAt: str | None
    recordsCount: int
    lastError: str | None


class PipelinesResponse(BaseModel):
    pipelines: list[PipelineHealthItem]


# Admin tenant management (Phase 5.8)

class AdminTenantResponse(BaseModel):
    id: str
    name: str
    slug: str
    status: str
    featureFlags: dict
    usersCount: int
    createdAt: str
    webhookUrl: str | None = None
    hasApiKey: bool = False


class AdminTenantListResponse(BaseModel):
    items: list[AdminTenantResponse]
    total: int


class AdminTenantCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str | None = Field(None, min_length=1, max_length=100)


class AdminTenantPatchRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    status: str | None = None
    featureFlags: dict | None = None
    webhookUrl: str | None = None


class AdminTenantUserItem(BaseModel):
    id: str
    email: str
    fullName: str
    role: str
    isActive: bool


class AdminTenantDetailResponse(AdminTenantResponse):
    users: list[AdminTenantUserItem]
    outsourcingRegister: list | None = None


class AdminTenantRotateKeyResponse(BaseModel):
    apiKey: str
    message: str = "Store this key securely. It will not be shown again."


# Admin audit log (Phase 5.10)

class AdminAuditEntryResponse(BaseModel):
    id: str
    tenantId: str | None
    tenantName: str
    user: str
    action: str
    resourceType: str
    resourceId: str | None
    createdAt: str
    payload: dict | None = None


class AdminAuditListResponse(BaseModel):
    items: list[AdminAuditEntryResponse]
    total: int
