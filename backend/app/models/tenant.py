"""Tenant and User models."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, Text, Boolean, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TenantStatus(str, enum.Enum):
    trial = "trial"
    active = "active"
    suspended = "suspended"
    terminated = "terminated"


class UserRole(str, enum.Enum):
    mlro = "mlro"
    compliance_officer = "compliance_officer"
    analyst = "analyst"
    developer = "developer"
    platform_admin = "platform_admin"
    platform_support = "platform_support"


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    status: Mapped[TenantStatus] = mapped_column(
        Enum(TenantStatus), nullable=False, default=TenantStatus.trial
    )
    feature_flags: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    outsourcing_register: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    api_key_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    webhook_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    users: Mapped[list["User"]] = relationship("User", back_populates="tenant", lazy="selectin")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tenant: Mapped["Tenant | None"] = relationship("Tenant", back_populates="users", lazy="selectin")


class VaspApplication(Base):
    """VASP application from the public Apply form."""
    __tablename__ = "vasp_applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    legal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    registration_number: Mapped[str] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    mlro_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mlro_email: Mapped[str] = mapped_column(String(255), nullable=False)
    compliance_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    admin_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    noc_status: Mapped[str] = mapped_column(String(50), nullable=False, default="not_applied")
    license_type: Mapped[str] = mapped_column(String(50), nullable=False, default="exchange")
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")  # pending, approved, rejected
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
