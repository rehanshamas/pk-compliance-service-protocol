"""Add beneficial_owners table, business_purpose/expected_activity on customers,
content_hash on records, freeze_records table, nullable case_id on isars,
frozen status to kyc_status enum.

Regulatory compliance: Reg. 9.2(c), 12.1, 13.2, 12.2.

Revision ID: 024
Revises: 023
Create Date: 2026-03-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, name: str) -> bool:
    r = conn.execute(text(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = :t"
    ), {"t": name})
    return r.scalar() is not None


def _column_exists(conn, table: str, column: str) -> bool:
    r = conn.execute(text(
        "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
    ), {"t": table, "c": column})
    return r.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    # --- Beneficial Owners table (Reg. 12.1) ---
    if not _table_exists(conn, "beneficial_owners"):
        op.create_table(
        "beneficial_owners",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("cnic_number", sa.String(20), nullable=True),
        sa.Column("nationality", sa.String(3), nullable=True),
        sa.Column("ownership_percentage", sa.Float, nullable=True),
        sa.Column("relationship", sa.String(128), nullable=True),
        sa.Column("screening_status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("last_screened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # --- Freeze Records table (Reg. 12.2) ---
    if not _table_exists(conn, "freeze_records"):
        op.create_table(
        "freeze_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("screening_result_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("alert_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("freeze_type", sa.String(64), nullable=False),
        sa.Column("matched_list", sa.String(64), nullable=True),
        sa.Column("matched_name", sa.String(255), nullable=True),
        sa.Column("match_score", sa.Float, nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="frozen"),
        sa.Column("frozen_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("reported_to_fmu_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unfrozen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unfreeze_reason", sa.String(128), nullable=True),
        sa.Column("frozen_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # --- Customer: business purpose + expected activity (Reg. 9.2(c)) ---
    if not _column_exists(conn, "customers", "business_purpose"):
        op.add_column("customers", sa.Column("business_purpose", sa.String(512), nullable=True))
    if not _column_exists(conn, "customers", "expected_activity"):
        op.add_column("customers", sa.Column("expected_activity", sa.String(512), nullable=True))

    # --- Records: content hash for tamper evidence (Reg. 13.2) ---
    if not _column_exists(conn, "records", "content_hash"):
        op.add_column("records", sa.Column("content_hash", sa.String(64), nullable=True))

    # --- ISARs: make case_id nullable (allow ISAR without case) ---
    # Only alter if not already nullable (check via information_schema)
    r = conn.execute(text(
        "SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='isars' AND column_name='case_id'"
    ))
    row = r.fetchone()
    if row and row[0] == "NO":
        op.alter_column("isars", "case_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)

    # --- Add 'frozen' to kyc_status enum ---
    # PostgreSQL requires explicit ALTER TYPE for enum changes
    # The enum may not exist if tables were created via init_db() rather than migrations
    result = conn.execute(text("SELECT typname FROM pg_type WHERE typname LIKE '%kyc%'"))
    enum_row = result.first()
    if enum_row:
        op.execute(f"ALTER TYPE {enum_row[0]} ADD VALUE IF NOT EXISTS 'frozen'")


def downgrade() -> None:
    # Note: dropping enum values is not supported in PostgreSQL
    # Revert column changes
    op.alter_column("isars", "case_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    op.drop_column("records", "content_hash")
    op.drop_column("customers", "expected_activity")
    op.drop_column("customers", "business_purpose")
    op.drop_table("freeze_records")
    op.drop_table("beneficial_owners")
