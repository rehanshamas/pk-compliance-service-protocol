"""EDD cases table and enhanced document types (Phase 4.10).

Revision ID: 008
Revises: 007
Create Date: 2026-03-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # Add proof_of_address and bank_statement to identity_documenttype enum
    for val in ("proof_of_address", "bank_statement"):
        r = conn.execute(
            sa.text(
                "SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid "
                f"WHERE t.typname = 'identity_documenttype' AND e.enumlabel = '{val}'"
            )
        )
        if r.fetchone() is None:
            op.execute(f"ALTER TYPE identity_documenttype ADD VALUE '{val}'")

    # Create edd_approval_status_enum (if not exists)
    r = conn.execute(sa.text(
        "SELECT 1 FROM pg_type WHERE typname = 'edd_approval_status_enum'"
    ))
    if r.fetchone() is None:
        op.execute("CREATE TYPE edd_approval_status_enum AS ENUM ('pending', 'approved', 'rejected')")

    # Create edd_cases table
    inspector = __import__("sqlalchemy").inspect(conn)
    if "edd_cases" not in inspector.get_table_names():
        op.create_table(
            "edd_cases",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("source_of_funds", sa.String(2000), nullable=True),
            sa.Column("source_of_funds_verified", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column(
                "approval_status",
                postgresql.ENUM(
                    "pending", "approved", "rejected",
                    name="edd_approval_status_enum",
                    create_type=False,  # We create it manually above; avoid duplicate
                ),
                nullable=False,
                server_default="pending",
            ),
            sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("approval_notes", sa.String(1000), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.ForeignKeyConstraint(["approved_by"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_edd_cases_customer_id"), "edd_cases", ["customer_id"], unique=True
        )
        op.create_index(
            op.f("ix_edd_cases_tenant_id"), "edd_cases", ["tenant_id"], unique=False
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = __import__("sqlalchemy").inspect(conn)
    if "edd_cases" in inspector.get_table_names():
        op.drop_index(op.f("ix_edd_cases_tenant_id"), table_name="edd_cases")
        op.drop_index(op.f("ix_edd_cases_customer_id"), table_name="edd_cases")
        op.drop_table("edd_cases")
    op.execute("DROP TYPE IF EXISTS edd_approval_status_enum")
    # Note: PostgreSQL does not support removing enum values; proof_of_address, bank_statement stay.
