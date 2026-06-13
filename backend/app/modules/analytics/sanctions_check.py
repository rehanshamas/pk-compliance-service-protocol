"""Sanctions wallet cross-reference. OFAC SDN crypto addresses. Phase 6.3 / WS-5."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.screening import WatchlistEntry, WatchlistSource


async def is_sanctioned_address(db: AsyncSession, address: str) -> bool:
    """Check if address appears in OFAC (or EU) crypto_addresses. Returns True if sanctioned."""
    address_lower = address.lower().strip()
    result = await db.execute(
        select(WatchlistEntry.crypto_addresses).where(
            WatchlistEntry.source.in_([WatchlistSource.ofac, WatchlistSource.eu]),
        )
    )
    for row in result.all():
        addrs = row.crypto_addresses or []
        for a in addrs:
            if isinstance(a, str) and a.lower() == address_lower:
                return True
            if isinstance(a, dict) and a.get("address", "").lower() == address_lower:
                return True
    return False


async def get_sanctioned_entries_for_address(
    db: AsyncSession, address: str
) -> list[dict]:
    """If sanctioned, return list of {source, primary_name} for attribution."""
    address_lower = address.lower().strip()
    out = []
    result = await db.execute(
        select(WatchlistEntry.id, WatchlistEntry.source, WatchlistEntry.primary_name, WatchlistEntry.crypto_addresses).where(
            WatchlistEntry.source.in_([WatchlistSource.ofac, WatchlistSource.eu]),
        )
    )
    for row in result.all():
        addrs = row.crypto_addresses or []
        for a in addrs:
            match = False
            if isinstance(a, str) and a.lower() == address_lower:
                match = True
            elif isinstance(a, dict) and a.get("address", "").lower() == address_lower:
                match = True
            if match:
                out.append({"source": row.source.value, "primaryName": row.primary_name})
                break
    return out


async def check_address_sanctions(db: AsyncSession, address: str) -> dict:
    """Check if a wallet address appears in OFAC/EU sanctions list.

    Returns dict with: ``is_sanctioned`` (bool), ``matches`` (list of matching entries).
    Used by the analytics service for detailed sanctions reporting in score results.
    """
    address_lower = address.lower().strip()

    result = await db.execute(
        select(WatchlistEntry).where(
            WatchlistEntry.source.in_([WatchlistSource.ofac, WatchlistSource.eu]),
            WatchlistEntry.crypto_addresses.isnot(None),
        )
    )
    entries = result.scalars().all()

    matches: list[dict] = []
    for entry in entries:
        addrs = entry.crypto_addresses or []
        for addr in addrs:
            addr_val = ""
            if isinstance(addr, str):
                addr_val = addr
            elif isinstance(addr, dict):
                addr_val = addr.get("address", "")
            if addr_val.lower() == address_lower:
                matches.append({
                    "entity_name": entry.primary_name,
                    "source": entry.source.value,
                    "address": addr_val,
                })
                break

    return {
        "is_sanctioned": len(matches) > 0,
        "matches": matches,
    }


async def check_counterparties_sanctions(
    db: AsyncSession, addresses: list[str],
) -> dict:
    """Batch-check a list of counterparty addresses against sanctions lists.

    Returns dict with ``sanctioned_addresses`` (list) and ``sanctioned_count`` (int).
    """
    if not addresses:
        return {"sanctioned_addresses": [], "sanctioned_count": 0}

    lowered = {a.lower().strip() for a in addresses if a}

    result = await db.execute(
        select(WatchlistEntry.crypto_addresses).where(
            WatchlistEntry.source.in_([WatchlistSource.ofac, WatchlistSource.eu]),
            WatchlistEntry.crypto_addresses.isnot(None),
        )
    )

    sanctioned_set: set[str] = set()
    for row in result.all():
        addrs = row.crypto_addresses or []
        for a in addrs:
            val = ""
            if isinstance(a, str):
                val = a
            elif isinstance(a, dict):
                val = a.get("address", "")
            if val.lower() in lowered:
                sanctioned_set.add(val.lower())

    return {
        "sanctioned_addresses": list(sanctioned_set),
        "sanctioned_count": len(sanctioned_set),
    }
