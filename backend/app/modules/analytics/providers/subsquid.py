"""Subsquid provider for indexed blockchain data (Layer 2 analytics). WS-5."""

import httpx

from app.config import settings


# Public Subsquid archive endpoints for EVM chains.
PUBLIC_SQUIDS = {
    "ethereum": "https://v2.archive.subsquid.io/network/ethereum-mainnet",
    "polygon": "https://v2.archive.subsquid.io/network/polygon-mainnet",
    "bsc": "https://v2.archive.subsquid.io/network/binance-mainnet",
}


class SubsquidProvider:
    """Fetch indexed chain data from Subsquid public archives or Cloud deployment."""

    def __init__(self) -> None:
        self._mode = "public"  # "public" or "cloud" -- admin-switchable at runtime
        self._cloud_url: str | None = None

    async def get_address_transactions(
        self,
        address: str,
        chain: str = "ethereum",
        limit: int = 100,
    ) -> list[dict]:
        """Query transactions involving *address* from Subsquid archive.

        Note: Public archives use a batch query API.  For full flexibility,
        Subsquid Cloud with a deployed squid is recommended.
        """
        base_url = self._cloud_url if self._mode == "cloud" else PUBLIC_SQUIDS.get(chain)
        if not base_url:
            return []

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Step 1: Get current chain height from archive
                worker_resp = await client.get(f"{base_url}/height")
                if worker_resp.status_code != 200:
                    return []

                height = worker_resp.json()
                from_block = max(0, height - 100_000)  # Last ~100k blocks

                # Step 2: Query transactions from archive
                query = {
                    "fromBlock": from_block,
                    "toBlock": height,
                    "transactions": [
                        {
                            "to": [address.lower()],
                            "sighash": [],
                        }
                    ],
                    "fields": {
                        "transaction": {
                            "hash": True,
                            "from": True,
                            "to": True,
                            "value": True,
                            "input": True,
                        },
                        "block": {
                            "timestamp": True,
                        },
                    },
                }

                resp = await client.post(
                    f"{base_url}/worker/query",
                    json=query,
                    timeout=30.0,
                )
                if resp.status_code != 200:
                    return []

                blocks = resp.json()
                txs: list[dict] = []
                for block in blocks[:limit]:
                    for tx in block.get("transactions", []):
                        txs.append(
                            {
                                "hash": tx.get("hash", ""),
                                "from": tx.get("from", ""),
                                "to": tx.get("to", ""),
                                "value": tx.get("value", "0"),
                                "block": block.get("header", {}).get("number", 0),
                                "timestamp": block.get("header", {}).get("timestamp", 0),
                            }
                        )
                return txs[:limit]
        except Exception:
            return []

    def configure(self, mode: str, cloud_url: str | None = None) -> None:
        """Update provider configuration (called when admin changes settings)."""
        self._mode = mode
        self._cloud_url = cloud_url


subsquid_provider = SubsquidProvider()
