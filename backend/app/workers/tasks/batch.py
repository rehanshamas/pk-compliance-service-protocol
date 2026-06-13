"""Celery task for batch screening."""

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Any

from celery import shared_task
from sqlalchemy import select, update

from app.config import settings
from app.models.screening import (
    BatchJob,
    BatchJobStatus,
    OverallStatus,
    ScreeningResult,
    ScreeningType,
    WatchlistEntry,
)
from app.modules.screening.matching import find_matches
from app.workers.db_sync import get_sync_session
from app.core.storage import upload_bytes


def _get_threshold() -> float:
    return getattr(settings, "screening_fuzzy_threshold", 70.0)


@shared_task(name="run_batch_screening", bind=True, max_retries=3)
def run_batch_screening(self: Any, job_id: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Process batch screening job. Rows: [{"name": str, "dob": str?, "id_number": str?}].
    Creates ScreeningResults, builds CSV, uploads to S3.
    """
    db = get_sync_session()
    try:
        result = db.execute(select(BatchJob).where(BatchJob.id == uuid.UUID(job_id)))
        job = result.scalar_one_or_none()
        if not job:
            return {"status": "error", "error": "Job not found"}

        if job.status != BatchJobStatus.queued:
            return {"status": "skipped", "reason": f"Job already {job.status.value}"}

        # Mark processing
        now = datetime.now(timezone.utc)
        db.execute(
            update(BatchJob)
            .where(BatchJob.id == job.id)
            .values(status=BatchJobStatus.processing, started_at=now)
        )
        db.commit()

        # Load watchlist
        wl_result = db.execute(
            select(
                WatchlistEntry.id,
                WatchlistEntry.primary_name,
                WatchlistEntry.aliases,
                WatchlistEntry.source,
            )
        )
        wl_rows = wl_result.all()
        entries = [
            (str(r.id), r.primary_name, r.aliases or [], r.source.value if r.source else "")
            for r in wl_rows
        ]

        threshold = _get_threshold()
        output_rows: list[dict[str, Any]] = []
        processed = 0

        for row in rows:
            name = (row.get("name") or "").strip()
            if not name:
                continue
            dob = row.get("dob") or None
            id_number = row.get("id_number") or None

            matches_data = find_matches(
                name,
                entries,
                threshold=threshold,
                use_aliases=True,
            )
            overall = (
                OverallStatus.potential_match
                if matches_data
                else OverallStatus.clear
            )

            sr = ScreeningResult(
                tenant_id=job.tenant_id,
                screened_entity_name=name,
                screened_entity_dob=dob,
                screened_entity_id=id_number,
                screening_type=ScreeningType.batch,
                matches=matches_data,
                overall_status=overall,
            )
            db.add(sr)
            db.flush()

            if matches_data:
                from app.modules.alerts.service import create_alert_for_screening_sync
                create_alert_for_screening_sync(db, job.tenant_id, sr)

            top_match = matches_data[0] if matches_data else None
            output_rows.append({
                "input_name": name,
                "input_dob": dob or "",
                "input_id": id_number or "",
                "result_id": str(sr.id),
                "status": overall.value,
                "match_score": top_match["score"] if top_match else "",
                "match_source": top_match.get("source", "") if top_match else "",
            })
            processed += 1

            # Progress update every 100 rows
            if processed % 100 == 0:
                db.execute(
                    update(BatchJob)
                    .where(BatchJob.id == job.id)
                    .values(processed_count=processed)
                )
                db.commit()

        # Build CSV
        buf = io.StringIO()
        writer = csv.DictWriter(
            buf,
            fieldnames=["input_name", "input_dob", "input_id", "result_id", "status", "match_score", "match_source"],
        )
        writer.writeheader()
        writer.writerows(output_rows)
        csv_bytes = buf.getvalue().encode("utf-8")

        # Upload to S3
        key = f"batch_jobs/{job_id}/results.csv"
        upload_bytes(key, csv_bytes, content_type="text/csv")

        # Mark complete
        db.execute(
            update(BatchJob)
            .where(BatchJob.id == job.id)
            .values(
                status=BatchJobStatus.complete,
                processed_count=processed,
                result_file_key=key,
                completed_at=datetime.now(timezone.utc),
                error_message=None,
            )
        )
        # Usage event for billing (Phase 3.9)
        from app.core.usage import record_usage_event_sync
        record_usage_event_sync(db, job.tenant_id, "screening.batch", quantity=float(processed), metadata={"job_id": job_id})
        db.commit()
        return {"status": "complete", "processed": processed, "result_key": key}

    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        err_msg = str(exc)
        try:
            jid = uuid.UUID(job_id)
            db.execute(
                update(BatchJob)
                .where(BatchJob.id == jid)
                .values(
                    status=BatchJobStatus.failed,
                    error_message=err_msg[:2000],
                    completed_at=datetime.now(timezone.utc),
                )
            )
            db.commit()
        except Exception:
            pass
        raise
    finally:
        db.close()
