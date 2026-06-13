"""Add kyc_sessions table for hosted KYC verification flow.

Revision ID: 028
Revises: 026
Create Date: 2026-03-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision: str = "028"
down_revision: Union[str, None] = "026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, name: str) -> bool:
    r = conn.execute(text(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = :t"
    ), {"t": name})
    return r.scalar() is not None


def _enum_exists(conn, name: str) -> bool:
    r = conn.execute(text(
        "SELECT 1 FROM pg_type WHERE typname = :t"
    ), {"t": name})
    return r.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    # Create enums if they don't exist
    if not _enum_exists(conn, "kyc_session_status_enum"):
        op.execute("CREATE TYPE kyc_session_status_enum AS ENUM ('pending', 'in_progress', 'completed', 'expired', 'failed')")

    if not _enum_exists(conn, "kyc_session_step_enum"):
        op.execute("CREATE TYPE kyc_session_step_enum AS ENUM ('upload', 'verify', 'liveness', 'complete')")

    if not _table_exists(conn, "kyc_sessions"):
        op.create_table(
            "kyc_sessions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customers.id"), nullable=True),

            # VASP-provided customer details
            sa.Column("external_ref", sa.String(255), nullable=True),
            sa.Column("customer_name", sa.String(255), nullable=True),
            sa.Column("customer_cnic", sa.String(20), nullable=True),
            sa.Column("customer_phone", sa.String(20), nullable=True),
            sa.Column("customer_dob", sa.Date, nullable=True),
            sa.Column("customer_nationality", sa.String(100), nullable=True),

            # Callback URLs
            sa.Column("web_callback_url", sa.String(1024), nullable=True),
            sa.Column("mobile_callback_url", sa.String(1024), nullable=True),

            # State
            sa.Column("status", sa.Enum("pending", "in_progress", "completed", "expired", "failed", name="kyc_session_status_enum", create_type=False), nullable=False, server_default="pending"),
            sa.Column("current_step", sa.Enum("upload", "verify", "liveness", "complete", name="kyc_session_step_enum", create_type=False), nullable=False, server_default="upload"),
            sa.Column("liveness_required", sa.Boolean, nullable=False, server_default=sa.text("false")),

            # Results
            sa.Column("kyc_status", sa.String(30), nullable=True),
            sa.Column("risk_tier", sa.String(20), nullable=True),

            # Timestamps
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    op.drop_table("kyc_sessions")
    op.execute("DROP TYPE IF EXISTS kyc_session_step_enum")
    op.execute("DROP TYPE IF EXISTS kyc_session_status_enum")
