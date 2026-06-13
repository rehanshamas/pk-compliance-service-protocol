"""Analytics API schemas. Phase 6.1."""

from pydantic import BaseModel, Field


class WalletScoreRequest(BaseModel):
    """POST /wallets/score — score a wallet address."""

    address: str = Field(..., min_length=10, max_length=128)
    chain: str = Field("ethereum", description="ethereum|bitcoin|bsc|polygon|tron")
    depth: str | None = Field(None, description="Scan depth override: layer_1, layer_2, or layer_3")


class WalletScoreResponse(BaseModel):
    """Unified risk score response. Same format for all resolution layers."""

    walletId: str
    address: str
    chain: str
    riskScore: int
    riskCategory: str
    exposureBreakdown: dict
    flaggedIndicators: list[str]
    confidenceLevel: str
    resolutionLayer: str
    chainsAnalyzed: list[str]
    cached: bool


class WalletListItem(BaseModel):
    """Wallet list item for GET /wallets."""

    id: str
    address: str
    chain: str
    riskScore: int
    riskCategory: str
    confidenceLevel: str
    resolutionLayer: str
    lastScoredAt: str | None
    createdAt: str


class WalletListResponse(BaseModel):
    """GET /wallets — paginated list of scored wallets."""

    items: list[WalletListItem]
    total: int


class WalletDetailResponse(BaseModel):
    """GET /wallets/{address} — wallet with score history."""

    id: str
    address: str
    chain: str
    riskScore: int
    riskCategory: str
    exposureBreakdown: dict
    flaggedIndicators: list[str]
    confidenceLevel: str
    resolutionLayer: str
    lastScoredAt: str | None
    scoreHistory: list[dict]


class WalletRegisterRequest(BaseModel):
    """POST /wallets/register — register a wallet for ongoing monitoring."""

    address: str = Field(..., min_length=10, max_length=128)
    chain: str = Field("ethereum", description="ethereum|bitcoin|bsc|polygon|tron")
    customer_id: str | None = Field(None, description="Link to a CIP customer ID")
    external_ref: str | None = Field(None, max_length=255, description="VASP's external reference")
    label: str | None = Field(None, max_length=100, description="Human-readable label")


class WalletRegisterResponse(BaseModel):
    """Response after registering a wallet for monitoring."""

    walletId: str
    address: str
    chain: str
    monitoringEnabled: bool
    riskScore: int
    riskCategory: str
    confidenceLevel: str
    resolutionLayer: str
    label: str | None = None
    externalRef: str | None = None
