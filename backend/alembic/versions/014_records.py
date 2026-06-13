"""Records table for 7-year retention. Phase 5.6.

Revision ID: 014
Revises: 013
Create Date: 2026-03-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "records" in inspector.get_table_names():
        return

    op.create_table(
        "records",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("record_type", sa.String(64), nullable=False),
        sa.Column("record_ref_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("file_key", sa.String(512), nullable=False),
        sa.Column("retention_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_records_tenant_id"), "records", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_records_record_type"), "records", ["record_type"], unique=False)
    op.create_index(op.f("ix_records_record_ref_id"), "records", ["record_ref_id"], unique=False)
    op.create_index(op.f("ix_records_retention_expires_at"), "records", ["retention_expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_records_retention_expires_at"), table_name="records")
    op.drop_index(op.f("ix_records_record_ref_id"), table_name="records")
    op.drop_index(op.f("ix_records_record_type"), table_name="records")
    op.drop_index(op.f("ix_records_tenant_id"), table_name="records")
    op.drop_table("records")
