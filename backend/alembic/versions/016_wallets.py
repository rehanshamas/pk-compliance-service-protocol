"""Wallets and wallet_risk_scores tables. Phase 6.1.

Revision ID: 016
Revises: 015
Create Date: 2026-03-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "wallets" in inspector.get_table_names():
        return

    op.create_table(
        "wallets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("address", sa.String(128), nullable=False),
        sa.Column(
            "chain",
            sa.Enum("ethereum", "bitcoin", "bsc", "polygon", "tron", name="chain"),
            nullable=False,
        ),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_scored_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_wallets_tenant_id"), "wallets", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_wallets_address"), "wallets", ["address"], unique=False)
    op.create_index(op.f("ix_wallets_chain"), "wallets", ["chain"], unique=False)

    op.create_table(
        "wallet_risk_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("wallet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("risk_score", sa.Integer(), nullable=False),
        sa.Column(
            "risk_category",
            sa.Enum("low", "medium", "high", "severe", name="riskcategory"),
            nullable=False,
        ),
        sa.Column("exposure_breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("flagged_indicators", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column(
            "confidence_level",
            sa.Enum("high", "medium", "low", name="confidencelevel"),
            nullable=False,
        ),
        sa.Column(
            "resolution_layer",
            sa.Enum("layer_1", "layer_2", "layer_3", name="resolutionlayer"),
            nullable=False,
        ),
        sa.Column("chains_analyzed", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("cached", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("cache_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["wallet_id"], ["wallets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_wallet_risk_scores_wallet_id"), "wallet_risk_scores", ["wallet_id"], unique=False)
    op.create_index(op.f("ix_wallet_risk_scores_tenant_id"), "wallet_risk_scores", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_wallet_risk_scores_risk_category"), "wallet_risk_scores", ["risk_category"], unique=False)
    op.create_index(op.f("ix_wallet_risk_scores_resolution_layer"), "wallet_risk_scores", ["resolution_layer"], unique=False)
    op.create_index(op.f("ix_wallet_risk_scores_created_at"), "wallet_risk_scores", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_wallet_risk_scores_created_at"), table_name="wallet_risk_scores")
    op.drop_index(op.f("ix_wallet_risk_scores_resolution_layer"), table_name="wallet_risk_scores")
    op.drop_index(op.f("ix_wallet_risk_scores_risk_category"), table_name="wallet_risk_scores")
    op.drop_index(op.f("ix_wallet_risk_scores_tenant_id"), table_name="wallet_risk_scores")
    op.drop_index(op.f("ix_wallet_risk_scores_wallet_id"), table_name="wallet_risk_scores")
    op.drop_table("wallet_risk_scores")
    op.drop_index(op.f("ix_wallets_chain"), table_name="wallets")
    op.drop_index(op.f("ix_wallets_address"), table_name="wallets")
    op.drop_index(op.f("ix_wallets_tenant_id"), table_name="wallets")
    op.drop_table("wallets")
    op.execute("DROP TYPE IF EXISTS resolutionlayer")
    op.execute("DROP TYPE IF EXISTS confidencelevel")
    op.execute("DROP TYPE IF EXISTS riskcategory")
    op.execute("DROP TYPE IF EXISTS chain")
