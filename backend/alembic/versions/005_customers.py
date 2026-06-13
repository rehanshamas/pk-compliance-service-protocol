"""Customers table for KYC (Phase 4.1).

Revision ID: 005
Revises: 004
Create Date: 2026-03-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = __import__("sqlalchemy").inspect(conn)
    if "customers" in inspector.get_table_names():
        return  # Already applied (e.g. from init_db or partial run)
    op.create_table(
        "customers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_ref", sa.String(255), nullable=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("dob", sa.Date(), nullable=True),
        sa.Column("nationality", sa.String(100), nullable=True),
        sa.Column("cnic_number", sa.String(20), nullable=True),
        sa.Column(
            "risk_tier",
            sa.Enum("low", "medium", "high", "prohibited", name="customer_risktier"),
            nullable=False,
            server_default="medium",
        ),
        sa.Column(
            "kyc_status",
            sa.Enum(
                "initiated",
                "documents_uploaded",
                "identity_verified",
                "liveness_checked",
                "risk_scored",
                "approved",
                "rejected",
                "edd_required",
                "edd_in_progress",
                name="customer_kycstatus",
            ),
            nullable=False,
            server_default="initiated",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_customers_tenant_id"), "customers", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_customers_external_ref"), "customers", ["external_ref"], unique=False)
    op.create_index(op.f("ix_customers_full_name"), "customers", ["full_name"], unique=False)
    op.create_index(op.f("ix_customers_cnic_number"), "customers", ["cnic_number"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_customers_cnic_number"), table_name="customers")
    op.drop_index(op.f("ix_customers_full_name"), table_name="customers")
    op.drop_index(op.f("ix_customers_external_ref"), table_name="customers")
    op.drop_index(op.f("ix_customers_tenant_id"), table_name="customers")
    op.drop_table("customers")
    op.execute("DROP TYPE IF EXISTS customer_kycstatus")
    op.execute("DROP TYPE IF EXISTS customer_risktier")
