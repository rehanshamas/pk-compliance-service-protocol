"""Monitoring rules table. Phase 6.6.

Revision ID: 017
Revises: 016
Create Date: 2026-03-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "monitoring_rules" in inspector.get_table_names():
        return

    op.create_table(
        "monitoring_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "rule_type",
            sa.Enum("threshold", "velocity", "pattern", "counterparty", "typology", name="monitoringruletype"),
            nullable=False,
        ),
        sa.Column("conditions", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column(
            "severity",
            sa.Enum("low", "medium", "high", "critical", name="monitoringruleseverity"),
            nullable=False,
        ),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_monitoring_rules_tenant_id"), "monitoring_rules", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_monitoring_rules_enabled"), "monitoring_rules", ["enabled"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_monitoring_rules_enabled"), table_name="monitoring_rules")
    op.drop_index(op.f("ix_monitoring_rules_tenant_id"), table_name="monitoring_rules")
    op.drop_table("monitoring_rules")
    op.execute("DROP TYPE IF EXISTS monitoringruletype")
    op.execute("DROP TYPE IF EXISTS monitoringruleseverity")
