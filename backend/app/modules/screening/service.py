"""Screening service: check, list, dispositions."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import NotFoundError, FeatureDisabledError
from sqlalchemy.orm import selectinload

from app.models.screening import (
    BatchJob,
    BatchJobStatus,
    MatchDisposition,
    ScreeningResult,
    ScreeningType,
    OverallStatus,
    DispositionStatus,
    WatchlistEntry,
    WatchlistSource,
    IngestionHealth,
    IngestionSource,
)
from app.modules.screening.matching import find_matches
from app.modules.screening.watchlist_cache import watchlist_cache


def _get_threshold() -> float:
    return getattr(settings, "screening_fuzzy_threshold", 70.0)


class ScreeningService:
    async def check(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        name: str,
        dob: str | None = None,
        id_number: str | None = None,
    ) -> ScreeningResult:
        """Real-time screening. Returns screening result with matches."""
        # Cache-first: try Redis watchlist cache, fall back to DB on miss
        cached = await watchlist_cache.get_all()
        if cached:
            entries = [
                (e["id"], e["primary_name"], e.get("aliases") or [], e.get("source", ""))
                for e in cached
            ]
        else:
            # Cache miss — load from DB and trigger async refresh
            result = await db.execute(
                select(WatchlistEntry.id, WatchlistEntry.primary_name, WatchlistEntry.aliases, WatchlistEntry.source)
            )
            rows = result.all()
            entries = [(str(r.id), r.primary_name, r.aliases or [], r.source.value if r.source else "") for r in rows]
            # Refresh cache for next request
            try:
                await watchlist_cache.refresh(db)
            except Exception:
                pass  # Non-fatal: screening still works from DB

        matches_data = find_matches(
            name,
            entries,
            threshold=_get_threshold(),
            use_aliases=True,
        )

        overall = (
            OverallStatus.potential_match
            if matches_data
            else OverallStatus.clear
        )

        screening_type = ScreeningType.realtime
        sr = ScreeningResult(
            tenant_id=tenant_id,
            screened_entity_name=name,
            screened_entity_dob=dob,
            screened_entity_id=id_number,
            screening_type=screening_type,
            matches=matches_data,
            overall_status=overall,
        )
        db.add(sr)
        await db.flush()

        # Create alert for screening matches (Phase 3.13)
        if matches_data:
            from app.modules.alerts.service import alert_service
            await alert_service.create_for_screening_result(db, tenant_id=tenant_id, screening_result=sr)

            # Dispatch webhook for screening match (WS-4)
            try:
                from app.core.webhooks import get_tenant_webhook_url
                webhook_url = await get_tenant_webhook_url(db, tenant_id)
                if webhook_url:
                    from app.workers.tasks.webhooks import deliver_webhook_task
                    deliver_webhook_task.delay(
                        webhook_url,
                        "screening.match",
                        {
                            "screening_result_id": str(sr.id),
                            "tenant_id": str(tenant_id),
                            "screened_entity_name": name,
                            "match_count": len(matches_data),
                            "overall_status": overall.value,
                            "matches": matches_data,
                        },
                    )
            except Exception:
                pass  # Non-fatal: webhook failure must not block screening

        # Log usage event (Phase 3.9)
        from app.core.usage import record_usage_event_async
        record_usage_event_async(db, tenant_id, "screening.check", quantity=1.0)

        return sr

    async def get_result(self, db: AsyncSession, result_id: UUID, tenant_id: UUID) -> ScreeningResult:
        result = await db.execute(
            select(ScreeningResult)
            .where(ScreeningResult.id == result_id, ScreeningResult.tenant_id == tenant_id)
        )
        sr = result.scalar_one_or_none()
        if not sr:
            raise NotFoundError("Screening result not found")
        return sr

    async def list_results(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        limit: int = 50,
        offset: int = 0,
        status: str | None = None,
    ) -> tuple[list[ScreeningResult], int]:
        from sqlalchemy.orm import aliased
        from app.models.screening import MatchDisposition

        base = select(ScreeningResult).where(ScreeningResult.tenant_id == tenant_id)
        if status:
            if status == "pending":
                # No disposition record
                base = base.outerjoin(MatchDisposition, ScreeningResult.id == MatchDisposition.screening_result_id)
                base = base.where(MatchDisposition.id.is_(None))
            else:
                base = base.join(MatchDisposition, ScreeningResult.id == MatchDisposition.screening_result_id)
                base = base.where(MatchDisposition.disposition == DispositionStatus(status))

        count_stmt = select(func.count()).select_from(base.subquery())
        total = (await db.scalar(count_stmt)) or 0
        q = base.order_by(ScreeningResult.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(q)
        rows = result.unique().scalars().all()
        return list(rows), total

    async def dispose(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        user_id: UUID,
        screening_result_id: UUID,
        disposition: str,
        rationale: str | None = None,
        user_role: "UserRole | None" = None,
    ) -> MatchDisposition:
        from app.models.tenant import UserRole
        from app.core.exceptions import ValidationError

        sr = await self.get_result(db, screening_result_id, tenant_id)
        disp_status = DispositionStatus(disposition)

        # Dismissing a sanctions match as false_positive requires MLRO review
        if disp_status == DispositionStatus.false_positive:
            if sr.matches:
                sanctions_sources = {"un", "ofac", "eu", "nacta", "opensanctions"}
                for m in sr.matches:
                    source = (m.get("source", "") if isinstance(m, dict) else "").lower()
                    if source in sanctions_sources:
                        if user_role and user_role not in (UserRole.mlro, UserRole.compliance_officer, UserRole.platform_admin):
                            raise ValidationError(
                                "Dismissing a sanctions match as false positive requires MLRO or Compliance Officer approval",
                                details={"source": source},
                            )
                        break

        existing = await db.execute(
            select(MatchDisposition).where(
                MatchDisposition.tenant_id == tenant_id,
                MatchDisposition.screening_result_id == screening_result_id,
            )
        )
        md = existing.scalar_one_or_none()
        if md:
            md.disposition = disp_status
            md.decided_by = user_id
            md.rationale = rationale
        else:
            md = MatchDisposition(
                screening_result_id=screening_result_id,
                tenant_id=tenant_id,
                disposition=disp_status,
                decided_by=user_id,
                rationale=rationale,
            )
            db.add(md)
        await db.flush()

        # If true_positive on a sanctions list (not PEP), create critical alert
        # suggesting immediate asset freeze per PVARA Reg. 12.2
        if disp_status == DispositionStatus.true_positive and sr.matches:
            top_match = sr.matches[0] if sr.matches else {}
            source = (top_match.get("source") or "").lower()
            sanctions_sources = ("un", "ofac", "eu", "nacta", "opensanctions")
            if source in sanctions_sources:
                try:
                    from app.models.alert import Alert, AlertSeverity, AlertSourceType, AlertStatus
                    from app.modules.notifications.service import notify_new_alert

                    summary = (
                        f"SANCTIONS MATCH CONFIRMED — {sr.screened_entity_name} matched on "
                        f"{source.upper()} list. Asset freeze required under Reg. 12.2. "
                        f"Freeze customer immediately."
                    )
                    alert = Alert(
                        tenant_id=tenant_id,
                        source_type=AlertSourceType.screening,
                        source_id=sr.id,
                        rule_id=None,
                        severity=AlertSeverity.critical,
                        status=AlertStatus.open,
                        summary=summary[:500],
                    )
                    db.add(alert)
                    await db.flush()
                    await notify_new_alert(db, tenant_id, alert.id, summary[:500])
                except Exception:
                    pass  # Non-fatal: alert creation must not block disposition

        return md

    async def get_ingestion_health(self, db: AsyncSession) -> list[IngestionHealth]:
        result = await db.execute(select(IngestionHealth).order_by(IngestionHealth.source))
        return list(result.scalars().all())

    async def create_batch_job(
        self, db: AsyncSession, tenant_id: UUID, rows: list[dict]
    ) -> BatchJob:
        """Create batch job and enqueue Celery task."""
        job = BatchJob(
            tenant_id=tenant_id,
            status=BatchJobStatus.queued,
            records_count=len(rows),
            processed_count=0,
        )
        db.add(job)
        await db.flush()
        job_id_str = str(job.id)
        from app.workers.tasks.batch import run_batch_screening
        run_batch_screening.delay(job_id_str, rows)
        return job

    async def list_batch_jobs(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[BatchJob], int]:
        base = select(BatchJob).where(BatchJob.tenant_id == tenant_id)
        total = await db.scalar(
            select(func.count()).select_from(BatchJob).where(BatchJob.tenant_id == tenant_id)
        )
        total = total or 0
        q = base.order_by(BatchJob.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(q)
        return list(result.scalars().all()), total

    async def get_batch_job(self, db: AsyncSession, job_id: UUID, tenant_id: UUID) -> BatchJob:
        result = await db.execute(
            select(BatchJob).where(
                BatchJob.id == job_id,
                BatchJob.tenant_id == tenant_id,
            )
        )
        job = result.scalar_one_or_none()
        if not job:
            raise NotFoundError("Batch job not found")
        return job


screening_service = ScreeningService()
