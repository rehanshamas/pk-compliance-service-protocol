"""Add phone column to customers table.

Revision ID: 026
Revises: 025
Create Date: 2026-03-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "026"
down_revision: Union[str, None] = "025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table: str, column: str) -> bool:
    r = conn.execute(text(
        "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
    ), {"t": table, "c": column})
    return r.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "customers", "phone"):
        op.add_column("customers", sa.Column("phone", sa.String(20), nullable=True))
        op.create_index("ix_customers_phone", "customers", ["phone"])


def downgrade() -> None:
    op.drop_index("ix_customers_phone", "customers")
    op.drop_column("customers", "phone")
