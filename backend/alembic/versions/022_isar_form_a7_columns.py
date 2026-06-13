"""Add PVARA Form A7 structured columns to isars table.

Revision ID: 022
Revises: 021
Create Date: 2026-03-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_columns = [c["name"] for c in inspector.get_columns("isars")]

    if "reporter_details" not in existing_columns:
        op.add_column("isars", sa.Column("reporter_details", postgresql.JSONB(), nullable=True))
    if "customer_details" not in existing_columns:
        op.add_column("isars", sa.Column("customer_details", postgresql.JSONB(), nullable=True))
    if "transaction_details" not in existing_columns:
        op.add_column("isars", sa.Column("transaction_details", postgresql.JSONB(), nullable=True))
    if "mlro_determination" not in existing_columns:
        op.add_column("isars", sa.Column("mlro_determination", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("isars", "mlro_determination")
    op.drop_column("isars", "transaction_details")
    op.drop_column("isars", "customer_details")
    op.drop_column("isars", "reporter_details")
