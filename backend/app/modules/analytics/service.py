"""Analytics service: wallet scoring with real Blockscout + Subsquid providers. Phase 6.1 / WS-5."""

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import NotFoundError
from app.core.usage import record_usage_event_async
from app.modules.analytics.cache import get_cached_score, set_cached_score
from app.modules.analytics.models import (
    Chain,
    ConfidenceLevel,
    ResolutionLayer,
    RiskCategory,
    Wallet,
    WalletRiskScore,
)
from app.modules.analytics.sanctions_check import (
    check_counterparties_sanctions,
    is_sanctioned_address,
)
from app.modules.analytics.providers.blockscout import blockscout_provider
from app.modules.analytics.providers.subsquid import subsquid_provider
from app.modules.analytics.providers.commercial import score_address as commercial_score_address

logger = logging.getLogger(__name__)


def _score_to_category(score: int) -> RiskCategory:
    if score >= 90:
        return RiskCategory.severe
    if score >= 70:
        return RiskCategory.high
    if score >= 40:
        return RiskCategory.medium
    return RiskCategory.low


def _calculate_blockscout_score(addr_info: dict, counterparty_sanctions: dict) -> dict:
    """Derive a risk score from Blockscout address data and counterparty analysis.

    Returns dict with: score (0-100), confidence, exposure, flagged.
    """
    if not addr_info.get("found"):
        # Unknown address -- moderate risk, low confidence
        return {
            "score": 50,
            "confidence": ConfidenceLevel.low,
            "exposure": {
                "mixer": 0,
                "sanctioned": 0,
                "gambling": 0,
                "exchange": 0,
                "unknown": 100,
            },
            "flagged": ["UNKNOWN_ADDRESS"],
        }

    tx_count = addr_info.get("tx_count", 0)
    balance_wei = int(addr_info.get("balance_wei") or 0)
    token_transfers = addr_info.get("token_transfers_count", 0)
    is_contract = addr_info.get("is_contract", False)
    is_verified = addr_info.get("is_verified", False)

    # --- Base score components (0-100) ---
    score = 10  # Start at baseline

    # Activity score: very low or very high tx counts are suspicious
    if tx_count == 0:
        score += 15  # Never-used address -- mildly suspicious
    elif tx_count < 5:
        score += 10  # Very new
    elif tx_count < 50:
        score += 0  # Normal activity
    elif tx_count < 500:
        score -= 5  # Established address -- slightly lower risk
    else:
        score += 5  # Very high activity -- slightly elevated

    # Balance factor: empty wallets with activity can be suspicious
    balance_eth = balance_wei / 1e18
    if balance_eth == 0 and tx_count > 10:
        score += 10  # Drained wallet with history
    elif balance_eth > 100:
        score += 5  # High value

    # Contract interaction pattern
    if is_contract and not is_verified:
        score += 15  # Unverified contract -- higher risk
    elif is_contract and is_verified:
        score -= 5  # Verified contract -- lower risk

    # Token transfer activity
    if token_transfers > 200:
        score += 5  # Heavy token activity

    # --- Counterparty sanctions exposure ---
    sanctioned_count = counterparty_sanctions.get("sanctioned_count", 0)
    sanctioned_addrs = counterparty_sanctions.get("sanctioned_addresses", [])
    if sanctioned_count > 0:
        # Direct counterparty sanctions exposure -- significant risk bump
        score += min(40, sanctioned_count * 20)  # Up to +40

    # Clamp to 0-100
    score = max(0, min(100, score))

    # --- Confidence level ---
    if tx_count >= 10 and addr_info.get("found"):
        confidence = ConfidenceLevel.high
    elif tx_count >= 3:
        confidence = ConfidenceLevel.medium
    else:
        confidence = ConfidenceLevel.low

    # --- Exposure breakdown ---
    sanctioned_pct = min(100, sanctioned_count * 15) if sanctioned_count else 0
    mixer_pct = min(15, score // 7) if score >= 40 else 0
    gambling_pct = min(10, score // 10) if score >= 30 else 0
    exchange_pct = max(5, 50 - score // 2) if score < 80 else 5
    unknown_pct = max(0, 100 - sanctioned_pct - mixer_pct - gambling_pct - exchange_pct)

    exposure = {
        "mixer": mixer_pct,
        "sanctioned": sanctioned_pct,
        "gambling": gambling_pct,
        "exchange": exchange_pct,
        "unknown": unknown_pct,
    }

    # --- Flagged indicators ---
    flagged: list[str] = []
    if sanctioned_count > 0:
        flagged.append("SANCTIONED_COUNTERPARTY")
    if score >= 70:
        flagged.append("ELEVATED_RISK")
    if score >= 85:
        flagged.append("SANCTIONS_PROXIMITY")
    if mixer_pct > 5:
        flagged.append("MIXER_EXPOSURE")
    if is_contract and not is_verified:
        flagged.append("UNVERIFIED_CONTRACT")
    if tx_count == 0:
        flagged.append("NO_ACTIVITY")

    return {
        "score": score,
        "confidence": confidence,
        "exposure": exposure,
        "flagged": flagged,
    }


class AnalyticsService:
    """Real scoring: Blockscout L1 + Subsquid L2 + commercial L3 fallback."""

    async def score_wallet(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        address: str,
        chain: str = "ethereum",
        tenant_flags: dict | None = None,
        requested_depth: str | None = None,
    ) -> dict:
        """Score a wallet. Cache-first. Sanctions override to severe. Real Layer 1 scoring.

        Args:
            tenant_flags: tenant feature_flags dict for layer preferences.
            requested_depth: optional override -- "layer_1", "layer_2", or "layer_3".
        """
        chain_enum = self._parse_chain(chain)
        address_lower = address.lower().strip()

        # 1. Check cache
        cached = await get_cached_score(tenant_id, chain_enum.value, address_lower)
        if cached:
            cached["cached"] = True
            return cached

        # 2. Sanctions cross-reference -- override to severe, no cache
        if await is_sanctioned_address(db, address_lower):
            return await self._persist_sanctioned_score(db, tenant_id, address_lower, chain_enum)

        # 3. Resolve layer preferences from tenant flags
        flags = tenant_flags or {}
        layer1_enabled = flags.get("analytics_layer1_enabled", True)
        layer2_enabled = flags.get("analytics_layer2_enabled", True)
        layer3_enabled = flags.get("analytics_layer3_enabled", False)
        default_depth = requested_depth or flags.get("analytics_default_depth", "layer_2")

        layer_config = {
            "layer1_enabled": layer1_enabled,
            "layer2_enabled": layer2_enabled,
            "layer3_enabled": layer3_enabled,
            "default_depth": default_depth,
        }

        # 4. Compute real score via Blockscout + optional Subsquid enrichment
        return await self._compute_and_persist_score(
            db, tenant_id, address_lower, chain_enum, layer_config=layer_config,
        )

    async def _persist_sanctioned_score(
        self, db: AsyncSession, tenant_id: UUID, address_lower: str, chain_enum: Chain
    ) -> dict:
        """Persist sanctioned wallet with risk_score=100, severe. No cache."""
        result = await db.execute(
            select(Wallet).where(
                Wallet.tenant_id == tenant_id,
                Wallet.address == address_lower,
                Wallet.chain == chain_enum,
            )
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            wallet = Wallet(
                tenant_id=tenant_id,
                address=address_lower,
                chain=chain_enum,
            )
            db.add(wallet)
            await db.flush()

        score = 100
        category = RiskCategory.severe
        exposure = {"mixer": 0, "sanctioned": 100, "gambling": 0, "exchange": 0, "unknown": 0}
        flagged = ["SANCTIONS_MATCH"]

        risk_score_record = WalletRiskScore(
            wallet_id=wallet.id,
            tenant_id=tenant_id,
            risk_score=score,
            risk_category=category,
            exposure_breakdown=exposure,
            flagged_indicators=flagged,
            confidence_level=ConfidenceLevel.high,
            resolution_layer=ResolutionLayer.layer_1,
            chains_analyzed=[chain_enum.value],
            cached=False,
        )
        db.add(risk_score_record)

        wallet.last_scored_at = datetime.now(timezone.utc)
        await db.flush()

        record_usage_event_async(db, tenant_id, "analytics.query", quantity=1.0)

        return {
            "walletId": str(wallet.id),
            "address": wallet.address,
            "chain": wallet.chain.value,
            "riskScore": score,
            "riskCategory": category.value,
            "exposureBreakdown": exposure,
            "flaggedIndicators": flagged,
            "confidenceLevel": ConfidenceLevel.high.value,
            "resolutionLayer": ResolutionLayer.layer_1.value,
            "chainsAnalyzed": [chain_enum.value],
            "cached": False,
        }

    async def _compute_and_persist_score(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        address_lower: str,
        chain_enum: Chain,
        layer_config: dict | None = None,
    ) -> dict:
        """Compute score using real Blockscout data + Subsquid enrichment + L3 fallback.

        layer_config keys: layer1_enabled, layer2_enabled, layer3_enabled, default_depth.
        """
        lc = layer_config or {}
        l1_enabled = lc.get("layer1_enabled", True)
        l2_enabled = lc.get("layer2_enabled", True)
        l3_enabled = lc.get("layer3_enabled", False)
        default_depth = lc.get("default_depth", "layer_2")

        # Determine max allowed layer based on config + depth request
        max_layer = 1
        if l2_enabled and default_depth in ("layer_2", "layer_3"):
            max_layer = 2
        if l3_enabled and default_depth == "layer_3":
            max_layer = 3
        result = await db.execute(
            select(Wallet).where(
                Wallet.tenant_id == tenant_id,
                Wallet.address == address_lower,
                Wallet.chain == chain_enum,
            )
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            wallet = Wallet(
                tenant_id=tenant_id,
                address=address_lower,
                chain=chain_enum,
            )
            db.add(wallet)
            await db.flush()

        # --- Layer 1: Blockscout ---
        addr_info = await blockscout_provider.get_address_info(
            address_lower, chain=chain_enum.value,
        )
        recent_txs = await blockscout_provider.get_recent_transactions(
            address_lower, chain=chain_enum.value, limit=50,
        )

        # Counterparty analysis: extract unique counterparties and check sanctions
        counterparties: set[str] = set()
        for tx in recent_txs:
            tx_from = tx.get("from", "")
            tx_to = tx.get("to", "")
            if tx_from and tx_from.lower() != address_lower:
                counterparties.add(tx_from.lower())
            if tx_to and tx_to.lower() != address_lower:
                counterparties.add(tx_to.lower())

        counterparty_sanctions = await check_counterparties_sanctions(
            db, list(counterparties),
        )

        scoring = _calculate_blockscout_score(addr_info, counterparty_sanctions)
        score = scoring["score"]
        confidence = scoring["confidence"]
        exposure = scoring["exposure"]
        flagged = scoring["flagged"]
        resolution_layer = ResolutionLayer.layer_1
        usage_type = "analytics.query"

        # --- Layer 2: Subsquid enrichment when L1 data is thin and L2 is allowed ---
        if confidence == ConfidenceLevel.low and max_layer >= 2:
            try:
                squid_txs = await subsquid_provider.get_address_transactions(
                    address_lower, chain=chain_enum.value, limit=100,
                )
                if squid_txs:
                    # Enrich: additional counterparties from Subsquid
                    squid_counterparties: set[str] = set()
                    for tx in squid_txs:
                        tx_from = tx.get("from", "")
                        tx_to = tx.get("to", "")
                        if tx_from and tx_from.lower() != address_lower:
                            squid_counterparties.add(tx_from.lower())
                        if tx_to and tx_to.lower() != address_lower:
                            squid_counterparties.add(tx_to.lower())

                    new_counterparties = squid_counterparties - counterparties
                    if new_counterparties:
                        extra_sanctions = await check_counterparties_sanctions(
                            db, list(new_counterparties),
                        )
                        if extra_sanctions["sanctioned_count"] > 0:
                            score = min(100, score + extra_sanctions["sanctioned_count"] * 20)
                            exposure["sanctioned"] = min(
                                100,
                                exposure["sanctioned"]
                                + extra_sanctions["sanctioned_count"] * 15,
                            )
                            flagged.append("SANCTIONED_COUNTERPARTY_L2")

                    # Bump confidence if Subsquid returned meaningful data
                    total_txs = len(recent_txs) + len(squid_txs)
                    if total_txs >= 10:
                        confidence = ConfidenceLevel.medium
                    resolution_layer = ResolutionLayer.layer_2
            except Exception:
                logger.warning(
                    "Subsquid enrichment failed for %s; continuing with L1 data",
                    address_lower,
                )

        # --- Layer 3: Commercial fallback when confidence still low/medium and L3 allowed ---
        category = _score_to_category(score)
        use_layer3 = (
            max_layer >= 3
            and confidence in (ConfidenceLevel.low, ConfidenceLevel.medium)
            and getattr(settings, "analytics_commercial_fallback_enabled", True)
        )

        if use_layer3:
            try:
                raw = await commercial_score_address(chain_enum.value, address_lower)
                score = raw["riskScore"]
                category = RiskCategory(raw["riskCategory"])
                exposure = raw["exposureBreakdown"]
                flagged = raw["flaggedIndicators"]
                resolution_layer = ResolutionLayer.layer_3
                confidence = ConfidenceLevel.high
                usage_type = "commercial.api"
            except Exception:
                logger.warning(
                    "Commercial fallback failed for %s; using L1/L2 score",
                    address_lower,
                )
                category = _score_to_category(score)

        risk_score_record = WalletRiskScore(
            wallet_id=wallet.id,
            tenant_id=tenant_id,
            risk_score=score,
            risk_category=category,
            exposure_breakdown=exposure,
            flagged_indicators=flagged,
            confidence_level=confidence,
            resolution_layer=resolution_layer,
            chains_analyzed=[chain_enum.value],
            cached=False,
        )
        db.add(risk_score_record)

        wallet.last_scored_at = datetime.now(timezone.utc)
        await db.flush()

        record_usage_event_async(db, tenant_id, usage_type, quantity=1.0)

        data = {
            "walletId": str(wallet.id),
            "address": wallet.address,
            "chain": wallet.chain.value,
            "riskScore": score,
            "riskCategory": category.value,
            "exposureBreakdown": exposure,
            "flaggedIndicators": flagged,
            "confidenceLevel": confidence.value,
            "resolutionLayer": resolution_layer.value,
            "chainsAnalyzed": [chain_enum.value],
            "cached": False,
        }

        # Cache -- severe not cached
        await set_cached_score(tenant_id, chain_enum.value, address_lower, data, score)

        # Fire webhook for high-risk wallets
        if score >= 70:
            try:
                from app.core.webhooks import get_tenant_webhook_url
                webhook_url = await get_tenant_webhook_url(db, tenant_id)
                if webhook_url:
                    from app.workers.tasks.webhooks import deliver_webhook_task
                    deliver_webhook_task.delay(
                        webhook_url,
                        "wallet.high_risk",
                        {
                            "wallet_id": str(wallet.id),
                            "address": wallet.address,
                            "chain": wallet.chain.value,
                            "risk_score": score,
                            "risk_category": category.value,
                            "tenant_id": str(tenant_id),
                        },
                    )
            except Exception:
                logger.warning("Failed to dispatch wallet.high_risk webhook", exc_info=True)

        # Auto-freeze check if wallet is linked to a customer
        if wallet.customer_id:
            try:
                from app.models.tenant import Tenant
                tenant_result = await db.execute(
                    select(Tenant).where(Tenant.id == tenant_id)
                )
                tenant = tenant_result.scalar_one_or_none()
                if tenant:
                    from app.core.auto_freeze import check_auto_freeze
                    await check_auto_freeze(
                        tenant,
                        wallet.customer_id,
                        "wallet_risk",
                        score,
                        db,
                        source_id=wallet.id,
                    )
            except Exception:
                logger.warning("Auto-freeze check failed for wallet %s", wallet.id, exc_info=True)

        return data

    async def register_wallet(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        address: str,
        chain: str = "ethereum",
        tenant_flags: dict | None = None,
        customer_id: str | None = None,
        external_ref: str | None = None,
        label: str | None = None,
    ) -> dict:
        """Register a wallet for ongoing monitoring. Does initial scoring."""
        chain_enum = self._parse_chain(chain)
        address_lower = address.lower().strip()

        # Find or create the wallet
        result = await db.execute(
            select(Wallet).where(
                Wallet.tenant_id == tenant_id,
                Wallet.address == address_lower,
                Wallet.chain == chain_enum,
            )
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            wallet = Wallet(
                tenant_id=tenant_id,
                address=address_lower,
                chain=chain_enum,
            )
            db.add(wallet)

        # Set monitoring fields
        wallet.monitoring_enabled = True
        if customer_id:
            import uuid as _uuid
            try:
                wallet.customer_id = _uuid.UUID(customer_id)
            except (ValueError, AttributeError):
                pass
        if external_ref is not None:
            wallet.external_ref = external_ref
        if label is not None:
            wallet.label = label
        await db.flush()

        # Do initial scoring
        score_data = await self.score_wallet(
            db,
            tenant_id=tenant_id,
            address=address_lower,
            chain=chain,
            tenant_flags=tenant_flags,
        )

        return {
            "walletId": score_data["walletId"],
            "address": score_data["address"],
            "chain": score_data["chain"],
            "monitoringEnabled": True,
            "riskScore": score_data["riskScore"],
            "riskCategory": score_data["riskCategory"],
            "confidenceLevel": score_data["confidenceLevel"],
            "resolutionLayer": score_data["resolutionLayer"],
            "label": label,
            "externalRef": external_ref,
        }

    async def list_wallets(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        limit: int = 50,
        offset: int = 0,
        risk_category: str | None = None,
        chain: str | None = None,
        search: str | None = None,
    ) -> tuple[list[dict], int]:
        """List scored wallets for tenant. Returns (items, total)."""
        scores_q = (
            select(WalletRiskScore)
            .where(WalletRiskScore.tenant_id == tenant_id)
            .order_by(WalletRiskScore.created_at.desc())
        )
        result = await db.execute(scores_q)
        all_scores = list(result.scalars().all())
        seen = {}
        for s in all_scores:
            if s.wallet_id not in seen:
                seen[s.wallet_id] = s

        wallet_ids = list(seen.keys())
        if not wallet_ids:
            return [], 0

        wallets_q = select(Wallet).where(Wallet.id.in_(wallet_ids))
        w_result = await db.execute(wallets_q)
        wallets = {w.id: w for w in w_result.scalars().all()}

        # Filter by risk_category and chain
        filtered_ids = []
        for wid in wallet_ids:
            w = wallets.get(wid)
            s = seen.get(wid)
            if not w or not s:
                continue
            if risk_category and s.risk_category.value != risk_category:
                continue
            if chain and w.chain.value != chain.lower():
                continue
            if search and search.lower() not in w.address.lower():
                continue
            filtered_ids.append(wid)

        # Sort by last_scored_at desc (fallback to first_seen_at)
        def _sort_key(wid):
            w = wallets.get(wid)
            if not w:
                return None
            return w.last_scored_at or w.first_seen_at

        filtered_ids.sort(key=_sort_key, reverse=True)
        total = len(filtered_ids)
        paginated_ids = filtered_ids[offset : offset + limit]

        if not paginated_ids:
            return [], total

        items = []
        for wid in paginated_ids:
            w = wallets.get(wid)
            s = seen.get(wid)
            if not w or not s:
                continue
            items.append({
                "id": str(w.id),
                "address": w.address,
                "chain": w.chain.value,
                "riskScore": s.risk_score,
                "riskCategory": s.risk_category.value,
                "confidenceLevel": s.confidence_level.value,
                "resolutionLayer": s.resolution_layer.value,
                "lastScoredAt": w.last_scored_at.isoformat() if w.last_scored_at else None,
                "createdAt": w.first_seen_at.isoformat(),
            })
        return items, total

    async def get_wallet_detail(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        address: str,
        chain: str = "ethereum",
    ) -> dict:
        """Get wallet with score history."""
        chain_enum = self._parse_chain(chain)
        address_lower = address.lower().strip()
        result = await db.execute(
            select(Wallet)
            .where(
                Wallet.tenant_id == tenant_id,
                Wallet.address == address_lower,
                Wallet.chain == chain_enum,
            )
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            raise NotFoundError("Wallet not found")

        scores_q = (
            select(WalletRiskScore)
            .where(WalletRiskScore.wallet_id == wallet.id)
            .order_by(WalletRiskScore.created_at.desc())
            .limit(30)
        )
        s_result = await db.execute(scores_q)
        scores = list(s_result.scalars().all())
        latest = scores[0] if scores else None
        if not latest:
            raise NotFoundError("No score for wallet")

        score_history = [
            {
                "riskScore": s.risk_score,
                "riskCategory": s.risk_category.value,
                "createdAt": s.created_at.isoformat(),
            }
            for s in scores
        ]
        return {
            "id": str(wallet.id),
            "address": wallet.address,
            "chain": wallet.chain.value,
            "riskScore": latest.risk_score,
            "riskCategory": latest.risk_category.value,
            "exposureBreakdown": latest.exposure_breakdown or {},
            "flaggedIndicators": latest.flagged_indicators or [],
            "confidenceLevel": latest.confidence_level.value,
            "resolutionLayer": latest.resolution_layer.value,
            "lastScoredAt": wallet.last_scored_at.isoformat() if wallet.last_scored_at else None,
            "scoreHistory": score_history,
        }

    def _parse_chain(self, chain: str) -> Chain:
        try:
            return Chain(chain.lower().strip())
        except ValueError:
            return Chain.ethereum


analytics_service = AnalyticsService()
