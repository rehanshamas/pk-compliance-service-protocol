"""Form A5 (Outsourcing Register) API. Phase 5.4."""

from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import FeatureDisabledError, NotFoundError
from app.database import get_db
from app.models.tenant import User
from app.core.usage import record_usage_event_async
from app.modules.tenants.service import tenant_service
from app.modules.compliance.forms import _get_register, generate_form_a5_html

router = APIRouter()


def _require_tenant(user: User) -> UUID:
    if not user.tenant_id:
        raise FeatureDisabledError("Platform admins use admin endpoints for Form A5.")
    return user.tenant_id


@router.get("/preview")
async def form_a5_preview(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return Form A5 outsourcing register data for preview (JSON)."""
    tenant_id = _require_tenant(user)
    tenant = await tenant_service.get_tenant(db, tenant_id)
    register = _get_register(tenant)
    return {
        "tenantName": tenant.name,
        "tenantSlug": tenant.slug,
        "outsourcingRegister": register,
    }


@router.get("/download")
async def form_a5_download(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate and download Form A5 as HTML document (printable, save as PDF)."""
    tenant_id = _require_tenant(user)
    tenant = await tenant_service.get_tenant(db, tenant_id)
    html = generate_form_a5_html(tenant)
    record_usage_event_async(db, tenant_id, "form.a5")
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in (tenant.slug or tenant.name or "outsourcing-register"))
    filename = f"Form-A5-{safe_name}.html"
    return Response(
        content=html,
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/download-docx")
async def form_a5_download_docx(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download Form A5 (Outsourcing Register) as editable DOCX."""
    tenant_id = _require_tenant(user)
    tenant = await tenant_service.get_tenant(db, tenant_id)
    from app.modules.compliance.forms_docx import generate_form_a5_docx
    docx_bytes = generate_form_a5_docx(tenant)
    record_usage_event_async(db, tenant_id, "form.a5")
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in (tenant.slug or tenant.name or "outsourcing-register"))
    filename = f"Form-A5-{safe_name}.docx"
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/download-pdf")
async def form_a5_download_pdf(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download Form A5 (Outsourcing Register) as PDF."""
    tenant_id = _require_tenant(user)
    tenant = await tenant_service.get_tenant(db, tenant_id)

    from app.modules.compliance.forms import generate_form_a5_html
    html = generate_form_a5_html(tenant)

    from app.core.pdf import html_to_pdf
    pdf_bytes = html_to_pdf(html)

    from app.core.usage import record_usage_event_async
    record_usage_event_async(db, tenant_id, "form.a5")

    safe_slug = (tenant.slug or tenant.name or "form-a5").replace("/", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Form-A5-{safe_slug}.pdf"'},
    )
