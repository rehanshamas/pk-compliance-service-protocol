"""Add discount_coupons table and vasp_settings_visibility to system_settings.

Revision ID: 025
Revises: 024
Create Date: 2026-03-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision: str = "025"
down_revision: Union[str, None] = "024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, name: str) -> bool:
    r = conn.execute(text(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = :t"
    ), {"t": name})
    return r.scalar() is not None


def _column_exists(conn, table: str, column: str) -> bool:
    r = conn.execute(text(
        "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
    ), {"t": table, "c": column})
    return r.scalar() is not None


def _fk_exists(conn, table: str, name: str) -> bool:
    r = conn.execute(text(
        "SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = :t AND constraint_name = :c AND constraint_type = 'FOREIGN KEY'"
    ), {"t": table, "c": name})
    return r.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    # --- discount_coupons ---
    if not _table_exists(conn, "discount_coupons"):
        op.create_table(
        "discount_coupons",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("discount_type", sa.String(20), nullable=False, server_default="percent"),  # percent | fixed
        sa.Column("discount_value", sa.Float, nullable=False, server_default=sa.text("0.0")),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("max_uses", sa.Integer, nullable=True),  # null = unlimited
        sa.Column("used_count", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("plan_ids", postgresql.JSONB, nullable=True),  # null = all plans; [] = restrict to listed
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # Add coupon_id and discount_amount to tenant_subscriptions (before coupon_redemptions)
    if not _column_exists(conn, "tenant_subscriptions", "coupon_id"):
        op.add_column(
            "tenant_subscriptions",
            sa.Column("coupon_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
    if not _column_exists(conn, "tenant_subscriptions", "discount_amount"):
        op.add_column(
            "tenant_subscriptions",
            sa.Column("discount_amount", sa.Float, nullable=False, server_default=sa.text("0.0")),
        )
    if not _fk_exists(conn, "tenant_subscriptions", "fk_tenant_subscriptions_coupon_id"):
        op.create_foreign_key(
            "fk_tenant_subscriptions_coupon_id",
            "tenant_subscriptions",
            "discount_coupons",
            ["coupon_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # --- coupon_redemptions (track who used which coupon) ---
    if not _table_exists(conn, "coupon_redemptions"):
        op.create_table(
        "coupon_redemptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column("coupon_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("discount_coupons.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenant_subscriptions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("discount_applied", sa.Float, nullable=False, server_default=sa.text("0.0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # Add discount_amount to invoices
    if not _column_exists(conn, "invoices", "discount_amount"):
        op.add_column(
            "invoices",
            sa.Column("discount_amount", sa.Float, nullable=False, server_default=sa.text("0.0")),
        )
    if not _column_exists(conn, "invoices", "coupon_code"):
        op.add_column(
            "invoices",
            sa.Column("coupon_code", sa.String(50), nullable=True),
        )

    # VASP settings visibility: added via settings_service.DEFAULT_SETTINGS on app startup


def downgrade() -> None:
    op.drop_column("invoices", "coupon_code")
    op.drop_column("invoices", "discount_amount")
    op.drop_table("coupon_redemptions")
    op.drop_constraint("fk_tenant_subscriptions_coupon_id", "tenant_subscriptions", type_="foreignkey")
    op.drop_column("tenant_subscriptions", "discount_amount")
    op.drop_column("tenant_subscriptions", "coupon_id")
    op.drop_table("discount_coupons")
