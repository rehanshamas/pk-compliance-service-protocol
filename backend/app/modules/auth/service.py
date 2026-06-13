"""Auth service: login, refresh, token creation."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.tenant import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_tokens(user_id: UUID, email: str, role: str, tenant_id: UUID | None) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    access_exp = now + timedelta(minutes=settings.access_token_expire_minutes)
    refresh_exp = now + timedelta(days=settings.refresh_token_expire_days)

    access_payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "tenant_id": str(tenant_id) if tenant_id else None,
        "exp": access_exp,
        "type": "access",
    }
    refresh_payload = {
        "sub": str(user_id),
        "exp": refresh_exp,
        "type": "refresh",
    }

    access_token = jwt.encode(
        access_payload,
        settings.jwt_private_key,
        algorithm=settings.jwt_algorithm,
    )
    refresh_token = jwt.encode(
        refresh_payload,
        settings.jwt_private_key,
        algorithm=settings.jwt_algorithm,
    )
    return access_token, refresh_token


class AuthService:
    async def login(
        self,
        db: AsyncSession,
        email: str,
        password: str,
    ) -> dict:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user or not verify_password(password, user.password_hash):
            from app.core.exceptions import AuthenticationError
            raise AuthenticationError("Invalid email or password")

        if not user.is_active:
            from app.core.exceptions import AuthenticationError
            raise AuthenticationError("Account is inactive")

        access_token, refresh_token = create_tokens(
            user.id, user.email, user.role.value, user.tenant_id
        )
        user.last_login_at = datetime.now(timezone.utc)
        await db.commit()

        tenant_name = user.tenant.name if user.tenant else "Platform"

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "fullName": user.full_name,
                "role": user.role.value,
                "tenantId": str(user.tenant_id) if user.tenant_id else "",
                "tenantName": tenant_name,
            },
        }

    async def refresh(self, db: AsyncSession, refresh_token: str) -> dict:
        from jose import JWTError
        from app.core.exceptions import AuthenticationError

        try:
            payload = jwt.decode(
                refresh_token,
                settings.jwt_public_key,
                algorithms=[settings.jwt_algorithm],
            )
            if payload.get("type") != "refresh":
                raise AuthenticationError("Invalid token type")
            user_id = payload.get("sub")
            if not user_id:
                raise AuthenticationError("Invalid token")
        except JWTError:
            raise AuthenticationError("Invalid or expired refresh token")

        result = await db.execute(select(User).where(User.id == UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")

        access_token, new_refresh = create_tokens(
            user.id, user.email, user.role.value, user.tenant_id
        )
        tenant_name = user.tenant.name if user.tenant else "Platform"

        return {
            "access_token": access_token,
            "refresh_token": new_refresh,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "fullName": user.full_name,
                "role": user.role.value,
                "tenantId": str(user.tenant_id) if user.tenant_id else "",
                "tenantName": tenant_name,
            },
        }


auth_service = AuthService()
