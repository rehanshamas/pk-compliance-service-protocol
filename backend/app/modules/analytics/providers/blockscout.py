"""Blockscout API provider for Layer 1 blockchain analytics. Phase 6.4 / WS-5."""

import httpx

from app.config import settings


# Chain -> Blockscout API base URL (public, no key required by default)
CHAIN_URLS = {
    "ethereum": "https://eth.blockscout.com",
    "bsc": "https://bsc.blockscout.com",
    "polygon": "https://polygon.blockscout.com",
}


class BlockscoutProvider:
    """Fetches address data from Blockscout for risk scoring."""

    def _base_url(self, chain: str) -> str:
        return CHAIN_URLS.get(chain.lower(), settings.blockscout_base_url).rstrip("/")

    def _headers(self) -> dict:
        headers: dict[str, str] = {}
        if settings.blockscout_api_key:
            headers["Authorization"] = f"Bearer {settings.blockscout_api_key}"
        return headers

    async def get_address_info(self, address: str, chain: str = "ethereum") -> dict:
        """Fetch address details from Blockscout v2 API.

        Returns a dict with ``found`` flag plus balance, tx_count, contract info, etc.
        """
        base = self._base_url(chain)
        headers = self._headers()

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                resp = await client.get(
                    f"{base}/api/v2/addresses/{address}",
                    headers=headers,
                )
                if resp.status_code == 404:
                    return {"found": False, "address": address}
                resp.raise_for_status()
                data = resp.json()
                return {
                    "found": True,
                    "address": address,
                    "balance_wei": data.get("coin_balance", "0"),
                    "tx_count": data.get("transactions_count", 0),
                    "token_transfers_count": data.get("token_transfers_count", 0),
                    "is_contract": data.get("is_contract", False),
                    "is_verified": data.get("is_verified", False),
                    "name": data.get("name"),
                    "creation_tx": data.get("creation_tx_hash"),
                }
            except httpx.HTTPError:
                return {"found": False, "address": address, "error": "Blockscout API unavailable"}

    async def get_recent_transactions(
        self, address: str, chain: str = "ethereum", limit: int = 50,
    ) -> list[dict]:
        """Fetch recent transactions for counterparty analysis."""
        base = self._base_url(chain)
        headers = self._headers()

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                resp = await client.get(
                    f"{base}/api/v2/addresses/{address}/transactions",
                    params={"limit": limit},
                    headers=headers,
                )
                if resp.status_code != 200:
                    return []
                data = resp.json()
                items = data.get("items", [])
                txs: list[dict] = []
                for tx in items[:limit]:
                    txs.append({
                        "hash": tx.get("hash", ""),
                        "from": tx.get("from", {}).get("hash", ""),
                        "to": (tx.get("to") or {}).get("hash", ""),
                        "value": tx.get("value", "0"),
                        "timestamp": tx.get("timestamp", ""),
                        "status": tx.get("status", ""),
                        "method": tx.get("method", ""),
                    })
                return txs
            except httpx.HTTPError:
                return []


blockscout_provider = BlockscoutProvider()


# Backwards-compatible module-level helper used by legacy code
async def get_address_info(chain: str, address: str) -> dict | None:
    """Fetch address info from Blockscout v2 API. Returns None on failure."""
    info = await blockscout_provider.get_address_info(address, chain=chain)
    if not info.get("found"):
        return None
    return info
