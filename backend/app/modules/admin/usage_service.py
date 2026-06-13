"""Admin usage metering: aggregate usage_events by tenant, event type, date. Phase 5.9."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.usage_event import UsageEvent

# Map event_type prefix to frontend category
EVENT_TO_CATEGORY = {
    "screening.": "screenings",
    "identity.": "verifications",
    "kyc.": "verifications",
    "analytics.": "analytics",
    "commercial.": "commercialApi",
}


def _categorize(event_type: str) -> str:
    for prefix, cat in EVENT_TO_CATEGORY.items():
        if event_type.startswith(prefix):
            return cat
    return "other"


class AdminUsageService:
    async def get_usage(
        self,
        db: AsyncSession,
        tenant_id: UUID | None = None,
        days: int = 30,
    ) -> dict:
        """Aggregate usage for dashboard. Returns tenants, totals, daily for charts."""
        start = datetime.now(timezone.utc) - timedelta(days=days)
        end = datetime.now(timezone.utc)

        # Base query: events in range
        base = (
            select(
                UsageEvent.tenant_id,
                UsageEvent.event_type,
                func.sum(UsageEvent.quantity).label("total"),
            )
            .where(UsageEvent.created_at >= start, UsageEvent.created_at <= end)
        )
        if tenant_id:
            base = base.where(UsageEvent.tenant_id == tenant_id)
        base = base.group_by(UsageEvent.tenant_id, UsageEvent.event_type)

        result = await db.execute(base)
        rows = result.all()

        # Build per-tenant aggregates
        tenant_data: dict[str, dict] = {}
        tenant_ids = set()

        for r in rows:
            tid = str(r.tenant_id)
            tenant_ids.add(r.tenant_id)
            if tid not in tenant_data:
                tenant_data[tid] = {
                    "verifications": 0.0,
                    "screenings": 0.0,
                    "analytics": 0.0,
                    "commercialApi": 0.0,
                }
            cat = _categorize(r.event_type)
            if cat in tenant_data[tid]:
                tenant_data[tid][cat] += float(r.total)
            elif cat == "other":
                tenant_data[tid]["screenings"] += float(r.total)

        # Load tenant names
        tenants = {}
        if tenant_ids:
            r = await db.execute(select(Tenant).where(Tenant.id.in_(tenant_ids)))
            for t in r.scalars().all():
                tenants[str(t.id)] = t.name

        tenants_list = [
            {
                "tenantId": tid,
                "tenantName": tenants.get(tid, "Unknown"),
                "verifications": int(d["verifications"]),
                "screenings": int(d["screenings"]),
                "analytics": int(d["analytics"]),
                "commercialApi": int(d["commercialApi"]),
            }
            for tid, d in tenant_data.items()
        ]

        totals = {
            "verifications": sum(d["verifications"] for d in tenant_data.values()),
            "screenings": sum(d["screenings"] for d in tenant_data.values()),
            "analytics": sum(d["analytics"] for d in tenant_data.values()),
            "commercialApi": sum(d["commercialApi"] for d in tenant_data.values()),
        }

        # Daily breakdown (last 7 days) for charts
        daily = await self._get_daily_breakdown(db, tenant_id, days=7)
        return {
            "tenants": tenants_list,
            "totals": totals,
            "daily": daily,
        }

    async def _get_daily_breakdown(
        self,
        db: AsyncSession,
        tenant_id: UUID | None,
        days: int = 7,
    ) -> list[dict]:
        """Daily aggregates for chart."""
        start = datetime.now(timezone.utc) - timedelta(days=days)
        # Use date_trunc for day grouping (PostgreSQL)
        day_col = func.date_trunc("day", UsageEvent.created_at).label("day")
        base = (
            select(
                day_col,
                UsageEvent.event_type,
                func.sum(UsageEvent.quantity).label("total"),
            )
            .where(UsageEvent.created_at >= start)
        )
        if tenant_id:
            base = base.where(UsageEvent.tenant_id == tenant_id)
        base = base.group_by(day_col, UsageEvent.event_type).order_by(day_col)
        result = await db.execute(base)
        rows = result.all()

        day_data: dict[str, dict] = {}
        for r in rows:
            day_str = (r.day.strftime("%b %d").lstrip("0").replace(" 0", " ") if r.day else "")
            if day_str not in day_data:
                day_data[day_str] = {
                    "date": day_str,
                    "verifications": 0.0,
                    "screenings": 0.0,
                    "analytics": 0.0,
                }
            cat = _categorize(r.event_type)
            if cat in day_data[day_str]:
                day_data[day_str][cat] += float(r.total)
            elif cat == "other":
                day_data[day_str]["screenings"] += float(r.total)

        out = []
        for i in range(days):
            dt = start + timedelta(days=i)
            key = dt.strftime("%b %d").lstrip("0").replace(" 0", " ")
            if key not in day_data:
                day_data[key] = {
                    "date": key,
                    "verifications": 0,
                    "screenings": 0,
                    "analytics": 0,
                }
            d = day_data[key]
            out.append({
                "date": d["date"],
                "verifications": int(d["verifications"]),
                "screenings": int(d["screenings"]),
                "analytics": int(d["analytics"]),
            })
        return out

    async def export_csv(
        self,
        db: AsyncSession,
        tenant_id: UUID | None,
        days: int,
    ) -> str:
        """Export usage as CSV string."""
        data = await self.get_usage(db, tenant_id=tenant_id, days=days)
        import io
        import csv
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["tenant_id", "tenant_name", "verifications", "screenings", "analytics", "commercial_api"])
        for t in data["tenants"]:
            w.writerow([
                t["tenantId"],
                t["tenantName"],
                t["verifications"],
                t["screenings"],
                t["analytics"],
                t["commercialApi"],
            ])
        w.writerow([])
        w.writerow(["totals", "", *[str(data["totals"][k]) for k in ["verifications", "screenings", "analytics", "commercialApi"]]])
        return buf.getvalue()


admin_usage_service = AdminUsageService()
