"""Add monitoring columns to wallets table.

Revision ID: 029
Revises: 028
Create Date: 2026-03-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "029"
down_revision: Union[str, None] = "028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_columns = [c["name"] for c in inspector.get_columns("wallets")]

    if "monitoring_enabled" not in existing_columns:
        op.add_column(
            "wallets",
            sa.Column("monitoring_enabled", sa.Boolean(), server_default="false", nullable=False),
        )

    if "customer_id" not in existing_columns:
        op.add_column(
            "wallets",
            sa.Column(
                "customer_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("customers.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )

    if "external_ref" not in existing_columns:
        op.add_column(
            "wallets",
            sa.Column("external_ref", sa.String(255), nullable=True),
        )

    if "label" not in existing_columns:
        op.add_column(
            "wallets",
            sa.Column("label", sa.String(100), nullable=True),
        )

    # Index for monitoring queries
    op.create_index(
        op.f("ix_wallets_monitoring_enabled"),
        "wallets",
        ["monitoring_enabled"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_wallets_monitoring_enabled"), table_name="wallets")
    op.drop_column("wallets", "label")
    op.drop_column("wallets", "external_ref")
    op.drop_column("wallets", "customer_id")
    op.drop_column("wallets", "monitoring_enabled")
