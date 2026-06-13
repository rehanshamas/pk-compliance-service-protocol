"""JWT and API key authentication."""

from datetime import datetime, timedelta, timezone
from hashlib import sha256

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AuthenticationError
from app.models.tenant import Tenant, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(sub: str, tenant_id: str, role: str) -> str:
    expire = datetime.now(tz=timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": sub, "tenant_id": tenant_id, "role": role, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.jwt_private_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(sub: str) -> str:
    expire = datetime.now(tz=timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    payload = {"sub": sub, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.jwt_private_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_public_key, algorithms=[settings.jwt_algorithm])
    except JWTError as e:
        raise AuthenticationError(f"Invalid token: {e}") from e


def hash_api_key(key: str) -> str:
    return sha256(key.encode()).hexdigest()


async def get_user_by_email(db: AsyncSession, email: str, tenant_id: str | None) -> User | None:
    result = await db.execute(
        select(User).where(User.email == email, User.tenant_id == tenant_id, User.is_active)
    )
    return result.scalar_one_or_none()


async def get_tenant_by_api_key_hash(db: AsyncSession, key_hash: str) -> Tenant | None:
    result = await db.execute(select(Tenant).where(Tenant.api_key_hash == key_hash))
    return result.scalar_one_or_none()
