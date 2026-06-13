"""Append-only audit log middleware. Writes mutating API calls to audit_log."""

import re
from uuid import UUID

from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.config import settings
from app.database import async_session_maker
from app.models.audit_log import AuditLog


MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
SKIP_PREFIXES = ("/health", "/docs", "/redoc", "/openapi")
UUID_PATTERN = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.IGNORECASE,
)


def _parse_resource_from_path(path: str) -> tuple[str, str | None]:
    """Derive resource_type and resource_id from path. E.g. /api/v1/cases/123 -> (case, 123)."""
    parts = [p for p in path.strip("/").split("/") if p]
    if len(parts) < 3 or parts[0] != "api" or parts[1] != "v1":
        return ("request", None)
    rest = parts[2:]
    resource_type = rest[0] if rest else "request"
    if resource_type == "admin" and len(rest) >= 2:
        resource_type = rest[1]  # admin/tenants -> tenants
    resource_id = None
    match = UUID_PATTERN.search(path)
    if match:
        resource_id = match.group(0)
    if resource_type.endswith("s") and resource_type not in ("isars", "reports"):
        resource_type = resource_type[:-1]
    elif resource_type == "isars":
        resource_type = "isar"
    return (resource_type, resource_id)


def _method_to_action(method: str) -> str:
    return {
        "POST": "create",
        "PUT": "update",
        "PATCH": "update",
        "DELETE": "delete",
    }.get(method, "request")


def _get_user_context(request: Request) -> tuple[UUID | None, UUID | None]:
    """Extract user_id, tenant_id from JWT. Returns (user_id, tenant_id)."""
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return (None, None)
    token = auth.split(" ", 1)[1]
    try:
        payload = jwt.decode(
            token,
            settings.jwt_public_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = payload.get("sub")
        tenant_id = payload.get("tenant_id")
        if user_id:
            return (UUID(user_id), UUID(tenant_id) if tenant_id else None)
    except (JWTError, ValueError, TypeError):
        pass
    return (None, None)


def _client_ip(request: Request) -> str | None:
    """Client IP from X-Forwarded-For or direct."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


class AuditMiddleware(BaseHTTPMiddleware):
    """Writes mutating API requests to audit_log."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        if request.method not in MUTATING_METHODS:
            return response
        if any(request.url.path.startswith(p) for p in SKIP_PREFIXES):
            return response

        user_id, tenant_id = _get_user_context(request)
        resource_type, resource_id_str = _parse_resource_from_path(request.url.path)
        action = _method_to_action(request.method)
        resource_id = UUID(resource_id_str) if resource_id_str else None

        try:
            async with async_session_maker() as session:
                entry = AuditLog(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    payload={
                        "method": request.method,
                        "path": request.url.path,
                        "status_code": response.status_code,
                    },
                    ip_address=_client_ip(request),
                    user_agent=request.headers.get("User-Agent", "")[:500],
                )
                session.add(entry)
                await session.commit()
        except Exception:
            # Never fail the request due to audit write failure
            pass

        return response
