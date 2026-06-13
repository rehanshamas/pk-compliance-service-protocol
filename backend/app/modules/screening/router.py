"""Screening routes: check, results list, dispositions, batch."""

import csv
import io
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import RedirectResponse

from app.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import FeatureDisabledError
from app.core.file_validation import validate_csv_upload
from app.core.storage import generate_presigned_download_url
from app.models.tenant import User
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.screening.schemas import (
    ScreeningCheckRequest,
    ScreeningCheckResponse,
    ScreeningResultListResponse,
    ScreeningResultDetail,
    DispositionRequest,
    BatchSubmitRequest,
    BatchJobResponse,
)
from app.modules.screening.service import screening_service

router = APIRouter()


def _require_tenant(user: User) -> UUID:
    if not user.tenant_id:
        raise FeatureDisabledError("Platform admins use admin endpoints for screening.")
    return user.tenant_id


@router.post("/check", response_model=ScreeningCheckResponse)
async def screening_check(
    body: ScreeningCheckRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Real-time name screening. Returns matches above threshold."""
    tenant_id = _require_tenant(user)
    sr = await screening_service.check(
        db,
        tenant_id=tenant_id,
        name=body.name,
        dob=body.dob,
        id_number=body.id_number,
    )
    return ScreeningCheckResponse(
        id=str(sr.id),
        screenedEntityName=sr.screened_entity_name,
        matches=[{"watchlistEntryId": m["watchlist_entry_id"], "score": m["score"]} for m in sr.matches],
        overallStatus=sr.overall_status.value,
        createdAt=sr.created_at.isoformat(),
    )


@router.get("/results", response_model=ScreeningResultListResponse)
async def list_screening_results(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None, description="Filter by disposition: pending, true_positive, false_positive, escalated"),
):
    """List screening results for tenant."""
    tenant_id = _require_tenant(user)
    results, total = await screening_service.list_results(
        db, tenant_id=tenant_id, limit=limit, offset=offset, status=status
    )
    items = [
        ScreeningResultDetail(
            id=str(r.id),
            screenedEntityName=r.screened_entity_name,
            source=r.matches[0]["source"] if r.matches else None,
            matchScore=r.matches[0]["score"] if r.matches else None,
            dispositionStatus=r.disposition.disposition.value if r.disposition else "pending",
            createdAt=r.created_at.isoformat(),
        )
        for r in results
    ]
    return ScreeningResultListResponse(items=items, total=total)


@router.get("/results/{result_id}", response_model=ScreeningResultDetail)
async def get_screening_result(
    result_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get single screening result with match details."""
    tenant_id = _require_tenant(user)
    sr = await screening_service.get_result(db, result_id=result_id, tenant_id=tenant_id)
    return ScreeningResultDetail(
        id=str(sr.id),
        screenedEntityName=sr.screened_entity_name,
        source=sr.matches[0]["source"] if sr.matches else None,
        matchScore=sr.matches[0]["score"] if sr.matches else None,
        dispositionStatus=sr.disposition.disposition.value if sr.disposition else "pending",
        createdAt=sr.created_at.isoformat(),
        matches=sr.matches,
    )


@router.post("/dispositions")
async def create_disposition(
    body: DispositionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Disposition a match: true_positive, false_positive, escalated."""
    tenant_id = _require_tenant(user)
    md = await screening_service.dispose(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        screening_result_id=body.screening_result_id,
        disposition=body.disposition,
        rationale=body.rationale,
        user_role=user.role,
    )
    return {"id": str(md.id), "disposition": md.disposition.value}


def _batch_job_to_response(job, download_url: str | None = None) -> BatchJobResponse:
    total = job.records_count or 1
    pct = min(100, int(100 * (job.processed_count or 0) / total)) if total else 0
    return BatchJobResponse(
        id=str(job.id),
        tenantId=str(job.tenant_id),
        recordsCount=job.records_count,
        status=job.status.value,
        progressPercent=pct,
        processedCount=job.processed_count or 0,
        startedAt=job.started_at.isoformat() if job.started_at else None,
        completedAt=job.completed_at.isoformat() if job.completed_at else None,
        errorMessage=job.error_message,
        downloadUrl=download_url,
    )


def _parse_csv_to_rows(content: bytes) -> list[dict]:
    """Parse CSV to list of {name, dob?, id_number?}. Supports name, Name, full_name, fullName, entity_name, screened_name, dob, DOB, date_of_birth, birth_date, id_number, id, cnic, CNIC, national_id."""
    reader = csv.DictReader(io.StringIO(content.decode("utf-8", errors="replace")))
    rows: list[dict] = []
    for r in reader:
        name = (
            r.get("name") or r.get("Name") or r.get("full_name") or r.get("fullName")
            or r.get("entity_name") or r.get("screened_name") or ""
        ).strip()
        if not name:
            continue
        dob = (r.get("dob") or r.get("DOB") or r.get("date_of_birth") or r.get("birth_date") or "").strip() or None
        id_num = (r.get("id_number") or r.get("id") or r.get("cnic") or r.get("CNIC") or r.get("national_id") or "").strip() or None
        rows.append({"name": name[:500], "dob": dob[:50] if dob else None, "id_number": id_num[:100] if id_num else None})
    return rows


@router.post("/batch", response_model=BatchJobResponse)
async def create_batch_job(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    file: UploadFile | None = File(None),
    body: BatchSubmitRequest | None = None,
):
    """Submit batch screening. Provide CSV file or JSON body with rows."""
    tenant_id = _require_tenant(user)
    if file:
        content = await file.read()
        try:
            validate_csv_upload(content, file.filename or "")
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        rows = _parse_csv_to_rows(content)
    elif body:
        rows = [{"name": r.name, "dob": r.dob, "id_number": r.id_number} for r in body.rows]
    else:
        raise HTTPException(400, "Provide CSV file or JSON body with rows")
    if not rows:
        raise HTTPException(400, "No valid rows to screen")
    if len(rows) > 5000:
        raise HTTPException(400, "Maximum 5000 rows per batch")
    job = await screening_service.create_batch_job(db, tenant_id=tenant_id, rows=rows)
    return _batch_job_to_response(job)


@router.get("/batch", response_model=dict)
async def list_batch_jobs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
):
    """List batch jobs for tenant."""
    tenant_id = _require_tenant(user)
    jobs, total = await screening_service.list_batch_jobs(db, tenant_id=tenant_id, limit=limit, offset=offset)
    items = [
        _batch_job_to_response(
            j,
            download_url=generate_presigned_download_url(j.result_file_key, expires_in=3600) if j.result_file_key else None,
        )
        for j in jobs
    ]
    return {"items": items, "total": total}


@router.get("/batch/{job_id}", response_model=BatchJobResponse)
async def get_batch_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get batch job status."""
    tenant_id = _require_tenant(user)
    job = await screening_service.get_batch_job(db, job_id=job_id, tenant_id=tenant_id)
    download_url = None
    if job.result_file_key:
        download_url = generate_presigned_download_url(job.result_file_key, expires_in=3600)
    return _batch_job_to_response(job, download_url=download_url)


@router.get("/batch/{job_id}/download")
async def download_batch_results(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Redirect to presigned download URL for batch results CSV."""
    tenant_id = _require_tenant(user)
    job = await screening_service.get_batch_job(db, job_id=job_id, tenant_id=tenant_id)
    if not job.result_file_key:
        raise HTTPException(404, "Results not ready yet")
    url = generate_presigned_download_url(job.result_file_key, expires_in=300)
    return RedirectResponse(url=url, status_code=302)
