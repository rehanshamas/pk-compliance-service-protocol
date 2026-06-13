"""Create vasp_applications table.

Revision ID: 023
Revises: 022
Create Date: 2026-03-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "vasp_applications" in inspector.get_table_names():
        return
    op.create_table(
        "vasp_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("legal_name", sa.String(255), nullable=False),
        sa.Column("registration_number", sa.String(100), nullable=True),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("mlro_name", sa.String(255), nullable=False),
        sa.Column("mlro_email", sa.String(255), nullable=False),
        sa.Column("compliance_email", sa.String(255), nullable=True),
        sa.Column("admin_email", sa.String(255), nullable=True),
        sa.Column("noc_status", sa.String(50), nullable=False, server_default="not_applied"),
        sa.Column("license_type", sa.String(50), nullable=False, server_default="exchange"),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("vasp_applications")
