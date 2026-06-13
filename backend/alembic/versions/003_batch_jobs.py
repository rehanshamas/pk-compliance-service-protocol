"""Batch jobs table for screening batch processing.

Revision ID: 003
Revises: 002
Create Date: 2026-03-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "batch_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            sa.Enum("queued", "processing", "complete", "failed", name="batchjobstatus"),
            nullable=False,
            server_default="queued",
        ),
        sa.Column("records_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("result_file_key", sa.String(500), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_batch_jobs_tenant_id"), "batch_jobs", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_batch_jobs_status"), "batch_jobs", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_batch_jobs_status"), table_name="batch_jobs")
    op.drop_index(op.f("ix_batch_jobs_tenant_id"), table_name="batch_jobs")
    op.drop_table("batch_jobs")
    op.execute("DROP TYPE IF EXISTS batchjobstatus")
