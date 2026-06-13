"""Auth routes: login, refresh."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.auth.schemas import LoginRequest, LoginResponse, RefreshRequest
from app.modules.auth.service import auth_service

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.login(db, body.email, body.password)


@router.post("/refresh", response_model=LoginResponse)
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.refresh(db, body.refresh_token)
