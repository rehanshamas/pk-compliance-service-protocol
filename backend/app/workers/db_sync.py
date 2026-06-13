"""Synchronous database session for Celery tasks."""

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.database import Base
import app.models  # noqa: F401 — register models with Base

_engine = create_engine(
    settings.database_url_sync,
    pool_pre_ping=True,
    pool_size=2,
    max_overflow=5,
)

_session_factory = sessionmaker(
    bind=_engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


def get_sync_session() -> Session:
    """Get a sync database session for Celery tasks."""
    return _session_factory()
