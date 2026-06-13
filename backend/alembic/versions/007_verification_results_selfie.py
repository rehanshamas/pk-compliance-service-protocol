"""Verification results table + selfie document type (Phase 4.4–4.6).

Revision ID: 007
Revises: 006
Create Date: 2026-03-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add selfie to identity_documenttype enum (PostgreSQL < 15 doesn't support IF NOT EXISTS)
    conn = op.get_bind()
    r = conn.execute(sa.text(
        "SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid "
        "WHERE t.typname = 'identity_documenttype' AND e.enumlabel = 'selfie'"
    ))
    if r.fetchone() is None:
        op.execute("ALTER TYPE identity_documenttype ADD VALUE 'selfie'")

    # Create verification_results table
    conn = op.get_bind()
    inspector = __import__("sqlalchemy").inspect(conn)
    if "verification_results" not in inspector.get_table_names():
        op.create_table(
            "verification_results",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column(
                "verification_type",
                sa.Enum(
                    "nadra",
                    "document_ocr",
                    "face_match",
                    "liveness",
                    name="verification_type_enum",
                ),
                nullable=False,
            ),
            sa.Column("provider", sa.String(128), nullable=False),
            sa.Column(
                "status",
                sa.Enum("pass", "fail", "inconclusive", name="verification_status_enum"),
                nullable=False,
            ),
            sa.Column("raw_response", postgresql.JSONB(), nullable=True),
            sa.Column("confidence_score", sa.Float(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_verification_results_customer_id"),
            "verification_results",
            ["customer_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_verification_results_tenant_id"),
            "verification_results",
            ["tenant_id"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_verification_results_tenant_id"), table_name="verification_results"
    )
    op.drop_index(
        op.f("ix_verification_results_customer_id"), table_name="verification_results"
    )
    op.drop_table("verification_results")
    op.execute("DROP TYPE IF EXISTS verification_type_enum")
    op.execute("DROP TYPE IF EXISTS verification_status_enum")
    # Note: PostgreSQL does not support removing enum values easily; selfie stays in enum.
