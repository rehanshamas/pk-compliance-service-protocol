"""Monitoring rules API schemas."""

from pydantic import BaseModel, Field


class MonitoringRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    tenantId: str | None = None  # Platform admin only: null = platform default
    ruleType: str = Field(..., pattern="^(threshold|velocity|pattern|counterparty|typology)$")
    conditions: dict = Field(default_factory=dict)
    severity: str = Field(..., pattern="^(low|medium|high|critical)$")
    enabled: bool = True


class MonitoringRulePatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    ruleType: str | None = Field(None, pattern="^(threshold|velocity|pattern|counterparty|typology)$")
    conditions: dict | None = None
    severity: str | None = Field(None, pattern="^(low|medium|high|critical)$")
    enabled: bool | None = None


class MonitoringRuleResponse(BaseModel):
    id: str
    tenantId: str | None
    name: str
    description: str | None
    ruleType: str
    conditions: dict
    severity: str
    enabled: bool
    createdAt: str
    updatedAt: str


class MonitoringRuleListResponse(BaseModel):
    items: list[MonitoringRuleResponse]
    total: int
