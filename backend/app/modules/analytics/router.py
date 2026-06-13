"""Analytics routes: wallet scoring. Phase 6.1."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user
from app.core.exceptions import FeatureDisabledError
from app.database import get_db
from app.models.tenant import User
from app.modules.analytics.schemas import (
    WalletDetailResponse,
    WalletListItem,
    WalletListResponse,
    WalletRegisterRequest,
    WalletRegisterResponse,
    WalletScoreRequest,
    WalletScoreResponse,
)
from app.modules.analytics.service import analytics_service
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


def _require_tenant(user: User) -> UUID:
    if not user.tenant_id:
        raise FeatureDisabledError("Platform admins use admin endpoints.")
    return user.tenant_id


@router.post("/register", response_model=WalletRegisterResponse)
async def register_wallet(
    body: WalletRegisterRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Register a wallet address for ongoing monitoring.
    CIP will periodically re-score this address and alert on risk changes.
    """
    tenant_id = _require_tenant(user)
    tenant_flags = (user.tenant.feature_flags or {}) if user.tenant else {}
    data = await analytics_service.register_wallet(
        db,
        tenant_id=tenant_id,
        address=body.address,
        chain=body.chain,
        tenant_flags=tenant_flags,
        customer_id=body.customer_id,
        external_ref=body.external_ref,
        label=body.label,
    )
    return WalletRegisterResponse(**data)


@router.post("/score", response_model=WalletScoreResponse)
async def score_wallet(
    body: WalletScoreRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Score a wallet address. Respects tenant layer preferences."""
    tenant_id = _require_tenant(user)
    tenant_flags = (user.tenant.feature_flags or {}) if user.tenant else {}
    data = await analytics_service.score_wallet(
        db,
        tenant_id=tenant_id,
        address=body.address,
        chain=body.chain,
        tenant_flags=tenant_flags,
        requested_depth=body.depth,
    )
    return WalletScoreResponse(**data)


@router.get("", response_model=WalletListResponse)
async def list_wallets(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    riskCategory: str | None = Query(None, description="Filter by risk: low|medium|high|severe"),
    chain: str | None = Query(None, description="Filter by chain: ethereum|bitcoin|bsc|polygon|tron"),
    search: str | None = Query(None, description="Search by wallet address"),
):
    """List scored wallets for tenant."""
    tenant_id = _require_tenant(user)
    items, total = await analytics_service.list_wallets(
        db,
        tenant_id=tenant_id,
        limit=limit,
        offset=offset,
        risk_category=riskCategory,
        chain=chain,
        search=search,
    )
    return WalletListResponse(
        items=[WalletListItem(**x) for x in items],
        total=total,
    )


@router.get("/{address}", response_model=WalletDetailResponse)
async def get_wallet(
    address: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    chain: str = Query("ethereum", description="ethereum|bitcoin|bsc|polygon|tron"),
):
    """Get wallet detail with score history."""
    tenant_id = _require_tenant(user)
    data = await analytics_service.get_wallet_detail(
        db, tenant_id=tenant_id, address=address, chain=chain
    )
    return WalletDetailResponse(**data)
