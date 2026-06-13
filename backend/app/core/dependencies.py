"""FastAPI dependencies: auth, tenant context, RBAC."""

from __future__ import annotations

from typing import Callable
from uuid import UUID

from fastapi import Depends, Request
from jose import JWTError, jwt
from sqlalchemy import select

from app.config import settings
from app.core.auth import get_tenant_by_api_key_hash, hash_api_key
from app.core.exceptions import AuthenticationError, AuthorizationError
from app.database import async_session_maker
from app.models.tenant import Tenant, TenantStatus, User

__all__ = [
    "get_current_user",
    "require_platform_admin",
    "get_tenant_from_api_key",
    "get_auth_context",
    "require_role",
]


async def get_current_user(request: Request) -> User:
    """Extract and validate JWT from Authorization header. Returns User model."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise AuthenticationError("Missing or invalid authorization header")

    token = auth_header.split(" ")[1]

    try:
        payload = jwt.decode(
            token,
            settings.jwt_public_key,
            algorithms=[settings.jwt_algorithm],
        )
        if payload.get("type") != "access":
            raise AuthenticationError("Invalid token type")
        user_id = payload.get("sub")
        if not user_id:
            raise AuthenticationError("Invalid token payload")
    except JWTError as e:
        raise AuthenticationError("Invalid or expired token") from e

    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.id == UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")
        return user


async def require_platform_admin(user: User = Depends(get_current_user)) -> User:
    """Require platform_admin or platform_support role."""
    if user.role.value not in ("platform_admin", "platform_support"):
        raise AuthorizationError("Admin access required")
    return user


async def get_tenant_from_api_key(request: Request) -> Tenant:
    """Authenticate via X-API-Key header. Returns Tenant model."""
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        raise AuthenticationError("Missing X-API-Key header")

    key_hash = hash_api_key(api_key)

    async with async_session_maker() as session:
        tenant = await get_tenant_by_api_key_hash(session, key_hash)
        if not tenant:
            raise AuthenticationError("Invalid API key")

    if tenant.status in (TenantStatus.suspended, TenantStatus.terminated):
        raise AuthorizationError(f"Tenant is {tenant.status.value}")

    return tenant


async def get_auth_context(request: Request) -> tuple[User | None, Tenant]:
    """Unified auth: try JWT first, fall back to API key.

    Returns (user, tenant) where user is None for API-key auth.
    """
    # Try JWT auth if Bearer token is present
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        user = await get_current_user(request)
        async with async_session_maker() as session:
            result = await session.execute(
                select(Tenant).where(Tenant.id == user.tenant_id)
            )
            tenant = result.scalar_one_or_none()
            if not tenant:
                raise AuthenticationError("Tenant not found for user")
        return user, tenant

    # Fall back to API key auth
    api_key = request.headers.get("X-API-Key")
    if api_key:
        tenant = await get_tenant_from_api_key(request)
        return None, tenant

    raise AuthenticationError(
        "Missing authentication: provide Bearer token or X-API-Key header"
    )


def require_role(*roles: str) -> Callable:
    """Return a dependency that enforces RBAC on the authenticated context.

    Usage: ``Depends(require_role("mlro", "compliance_officer"))``

    For API-key auth (no user), access is granted only when ``"developer"``
    is among the allowed *roles*.
    """

    async def _check_role(
        auth_context: tuple[User | None, Tenant] = Depends(get_auth_context),
    ) -> tuple[User | None, Tenant]:
        user, tenant = auth_context

        if user is None:
            # API-key (machine) access — permit only if "developer" role allowed
            if "developer" not in roles:
                raise AuthorizationError(
                    "API key access not permitted for this endpoint"
                )
            return user, tenant

        if user.role.value not in roles:
            raise AuthorizationError(
                f"Role '{user.role.value}' is not permitted; requires one of {roles}"
            )
        return user, tenant

    return _check_role
