"""Billing models: service plans, subscriptions, pricing, invoices.

Revision ID: 020
Revises: 019
Create Date: 2026-03-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Enum values used across tables
SERVICE_TYPE_VALUES = ("kyc", "screening", "analytics_l1", "analytics_l3", "reports", "form_generation")
BILLING_CYCLE_VALUES = ("monthly", "quarterly", "annual")
INVOICE_STATUS_VALUES = ("draft", "issued", "paid", "overdue", "cancelled")

service_type_enum = postgresql.ENUM(*SERVICE_TYPE_VALUES, name="servicetype", create_type=False)
billing_cycle_enum = postgresql.ENUM(*BILLING_CYCLE_VALUES, name="billingcycle", create_type=False)
invoice_status_enum = postgresql.ENUM(*INVOICE_STATUS_VALUES, name="invoicestatus", create_type=False)


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # Create enum types
    service_type_enum.create(conn, checkfirst=True)
    billing_cycle_enum.create(conn, checkfirst=True)
    invoice_status_enum.create(conn, checkfirst=True)

    # --- service_plans ---
    if "service_plans" not in existing_tables:
        op.create_table(
            "service_plans",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
            sa.Column("name", sa.String(100), unique=True, nullable=False),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("is_default", sa.Boolean, server_default=sa.text("false"), nullable=False),
            sa.Column("is_trial", sa.Boolean, server_default=sa.text("false"), nullable=False),
            sa.Column("billing_cycle", billing_cycle_enum, nullable=False, server_default="monthly"),
            sa.Column("base_price", sa.Float, nullable=False, server_default=sa.text("0.0")),
            sa.Column("is_active", sa.Boolean, server_default=sa.text("true"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # --- pricing_rules ---
    if "pricing_rules" not in existing_tables:
        op.create_table(
            "pricing_rules",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
            sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("service_type", service_type_enum, nullable=False),
            sa.Column("included_in_plan", sa.Boolean, server_default=sa.text("false"), nullable=False),
            sa.Column("price_per_unit", sa.Float, nullable=False, server_default=sa.text("0.0")),
            sa.Column("quota_limit", sa.Integer, nullable=False, server_default=sa.text("0")),
            sa.Column("overage_price_per_unit", sa.Float, nullable=False, server_default=sa.text("0.0")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["plan_id"], ["service_plans.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("plan_id", "service_type", name="uq_pricing_rule_plan_service"),
        )

    # --- tenant_subscriptions ---
    if "tenant_subscriptions" not in existing_tables:
        op.create_table(
            "tenant_subscriptions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("is_active", sa.Boolean, server_default=sa.text("true"), nullable=False),
            sa.Column("billing_cycle", billing_cycle_enum, nullable=False, server_default="monthly"),
            sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=False),
            sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=False),
            sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("grace_period_hours", sa.Integer, server_default=sa.text("48"), nullable=False),
            sa.Column("custom_overrides", postgresql.JSONB, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["plan_id"], ["service_plans.id"]),
        )
        op.create_index(
            op.f("ix_tenant_subscriptions_tenant_id"),
            "tenant_subscriptions",
            ["tenant_id"],
            unique=False,
        )

    # --- service_usage_summaries ---
    if "service_usage_summaries" not in existing_tables:
        op.create_table(
            "service_usage_summaries",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("service_type", service_type_enum, nullable=False),
            sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
            sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
            sa.Column("total_usage", sa.Integer, server_default=sa.text("0"), nullable=False),
            sa.Column("quota_limit", sa.Integer, server_default=sa.text("0"), nullable=False),
            sa.Column("overage_count", sa.Integer, server_default=sa.text("0"), nullable=False),
            sa.Column("is_overage_alerted", sa.Boolean, server_default=sa.text("false"), nullable=False),
            sa.Column("grace_period_expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("tenant_id", "service_type", "period_start", name="uq_usage_summary_tenant_service_period"),
        )
        op.create_index(
            op.f("ix_service_usage_summaries_tenant_id"),
            "service_usage_summaries",
            ["tenant_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_service_usage_summaries_service_type"),
            "service_usage_summaries",
            ["service_type"],
            unique=False,
        )

    # --- invoices ---
    if "invoices" not in existing_tables:
        op.create_table(
            "invoices",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("invoice_number", sa.String(50), unique=True, nullable=False),
            sa.Column("status", invoice_status_enum, nullable=False, server_default="draft"),
            sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
            sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
            sa.Column("subtotal", sa.Float, nullable=False, server_default=sa.text("0.0")),
            sa.Column("tax_amount", sa.Float, nullable=False, server_default=sa.text("0.0")),
            sa.Column("total", sa.Float, nullable=False, server_default=sa.text("0.0")),
            sa.Column("currency", sa.String(3), nullable=False, server_default="PKR"),
            sa.Column("line_items", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        )
        op.create_index(
            op.f("ix_invoices_tenant_id"),
            "invoices",
            ["tenant_id"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_table("invoices")
    op.drop_table("service_usage_summaries")
    op.drop_table("tenant_subscriptions")
    op.drop_table("pricing_rules")
    op.drop_table("service_plans")

    conn = op.get_bind()
    invoice_status_enum.drop(conn, checkfirst=True)
    billing_cycle_enum.drop(conn, checkfirst=True)
    service_type_enum.drop(conn, checkfirst=True)
