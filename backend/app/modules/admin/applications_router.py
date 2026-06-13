"""VASP application management for platform admins."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_platform_admin
from app.database import get_db
from app.models.tenant import User, VaspApplication

router = APIRouter()


@router.get("")
async def list_applications(
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    query = select(VaspApplication)
    count_query = select(func.count(VaspApplication.id))
    if status:
        query = query.where(VaspApplication.status == status)
        count_query = count_query.where(VaspApplication.status == status)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(VaspApplication.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": [
            {
                "id": str(a.id),
                "companyName": a.company_name,
                "legalName": a.legal_name,
                "registrationNumber": a.registration_number,
                "address": a.address,
                "mlroName": a.mlro_name,
                "mlroEmail": a.mlro_email,
                "complianceEmail": a.compliance_email,
                "adminEmail": a.admin_email,
                "nocStatus": a.noc_status,
                "licenseType": a.license_type,
                "status": a.status,
                "notes": a.notes,
                "createdAt": a.created_at.isoformat() if a.created_at else None,
            }
            for a in items
        ],
        "total": total,
        "page": page,
        "perPage": per_page,
    }


@router.post("", status_code=201)
async def create_application(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint — no auth required. VASPs submit applications."""
    app = VaspApplication(
        company_name=body.get("companyName", ""),
        legal_name=body.get("legalName", ""),
        registration_number=body.get("registrationNumber"),
        address=body.get("address"),
        mlro_name=body.get("mlroName", ""),
        mlro_email=body.get("mlroEmail", ""),
        compliance_email=body.get("complianceEmail"),
        admin_email=body.get("adminEmail"),
        noc_status=body.get("nocStatus", "not_applied"),
        license_type=body.get("licenseType", "exchange"),
    )
    db.add(app)
    await db.flush()
    return {"status": "success", "data": {"id": str(app.id)}}


@router.patch("/{app_id}")
async def update_application(
    app_id: UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Approve or reject an application."""
    result = await db.execute(select(VaspApplication).where(VaspApplication.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Application not found")

    action = body.get("action")
    if action == "approve":
        app.status = "approved"
        if body.get("create_tenant") and body.get("tenant_slug"):
            from app.modules.admin.tenant_service import admin_tenant_service
            await admin_tenant_service.create(
                db, name=app.company_name, slug=body["tenant_slug"]
            )
    elif action == "reject":
        app.status = "rejected"
        if "notes" in body:
            app.notes = body["notes"]

    if "status" in body and not action:
        app.status = body["status"]
    if "notes" in body and action != "reject":
        app.notes = body["notes"]

    await db.flush()
    return {"status": "success", "data": {"id": str(app.id), "status": app.status}}
