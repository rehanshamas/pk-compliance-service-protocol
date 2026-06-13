"""Shufti e-IDV pending verifications. Phase 7 — Shufti fallback.

Revision ID: 018
Revises: 017
Create Date: 2026-03-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "shufti_pending_verifications" in inspector.get_table_names():
        return

    op.create_table(
        "shufti_pending_verifications",
        sa.Column("reference", sa.String(250), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("reference"),
    )
    op.create_index(
        op.f("ix_shufti_pending_verifications_customer_id"),
        "shufti_pending_verifications",
        ["customer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_shufti_pending_verifications_tenant_id"),
        "shufti_pending_verifications",
        ["tenant_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_shufti_pending_verifications_tenant_id"),
        table_name="shufti_pending_verifications",
    )
    op.drop_index(
        op.f("ix_shufti_pending_verifications_customer_id"),
        table_name="shufti_pending_verifications",
    )
    op.drop_table("shufti_pending_verifications")
