"""ISAR (Internal Suspicious Activity Report / Form A7) table. Phase 5.2.

Revision ID: 011
Revises: 010
Create Date: 2026-03-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum type (idempotent)
    conn = op.get_bind()
    r = conn.execute(sa.text("SELECT 1 FROM pg_type WHERE typname = 'isarstatus'"))
    if r.fetchone() is None:
        op.execute(
            "CREATE TYPE isarstatus AS ENUM ("
            "'draft', 'submitted_for_review', 'approved', 'rejected', 'filed_as_str')"
        )

    # Skip if table already exists (idempotent for re-runs)
    inspector = sa.inspect(conn)
    if "isars" in inspector.get_table_names():
        return

    status_enum = postgresql.ENUM(
        "draft", "submitted_for_review", "approved", "rejected", "filed_as_str",
        name="isarstatus",
        create_type=False,
    )

    op.create_table(
        "isars",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("suspicion_type", sa.String(128), nullable=False),
        sa.Column("narrative", sa.Text(), nullable=False),
        sa.Column("supporting_evidence", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", status_enum, nullable=False, server_default="draft"),
        sa.Column("submitted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("filed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_rationale", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subject_customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_isars_tenant_id"), "isars", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_isars_case_id"), "isars", ["case_id"], unique=False)
    op.create_index(op.f("ix_isars_subject_customer_id"), "isars", ["subject_customer_id"], unique=False)
    op.create_index(op.f("ix_isars_status"), "isars", ["status"], unique=False)
    op.create_index(op.f("ix_isars_submitted_by"), "isars", ["submitted_by"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_isars_submitted_by"), table_name="isars")
    op.drop_index(op.f("ix_isars_status"), table_name="isars")
    op.drop_index(op.f("ix_isars_subject_customer_id"), table_name="isars")
    op.drop_index(op.f("ix_isars_case_id"), table_name="isars")
    op.drop_index(op.f("ix_isars_tenant_id"), table_name="isars")
    op.drop_table("isars")
    op.execute("DROP TYPE IF EXISTS isarstatus")
