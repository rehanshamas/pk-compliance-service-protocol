"""Screening schema: watchlist_entries, screening_results, match_dispositions, ingestion_health.

Revision ID: 002
Revises: 001
Create Date: 2026-03-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "watchlist_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.Enum("un", "ofac", "eu", "nacta", "pep", "opensanctions", name="watchlistsource"), nullable=False),
        sa.Column("entity_type", sa.Enum("individual", "entity", "vessel", "aircraft", name="entitytype"), nullable=False),
        sa.Column("primary_name", sa.String(500), nullable=False),
        sa.Column("aliases", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("dob", sa.String(50), nullable=True),
        sa.Column("nationality", sa.String(100), nullable=True),
        sa.Column("id_numbers", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("list_specific_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("crypto_addresses", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("ingested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("source_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_watchlist_entries_source"), "watchlist_entries", ["source"], unique=False)
    op.create_index(op.f("ix_watchlist_entries_primary_name"), "watchlist_entries", ["primary_name"], unique=False)

    op.create_table(
        "screening_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("screened_entity_name", sa.String(500), nullable=False),
        sa.Column("screened_entity_dob", sa.String(50), nullable=True),
        sa.Column("screened_entity_id", sa.String(100), nullable=True),
        sa.Column("screening_type", sa.Enum("realtime", "batch", "ongoing_monitoring", name="screeningtype"), nullable=False),
        sa.Column("matches", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("overall_status", sa.Enum("clear", "potential_match", "confirmed_match", name="overallstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_screening_results_tenant_id"), "screening_results", ["tenant_id"], unique=False)

    op.create_table(
        "match_dispositions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("screening_result_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("disposition", sa.Enum("pending", "true_positive", "false_positive", "escalated", name="dispositionstatus"), nullable=False),
        sa.Column("decided_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["screening_result_id"], ["screening_results.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("screening_result_id"),
    )
    op.create_index(op.f("ix_match_dispositions_screening_result_id"), "match_dispositions", ["screening_result_id"], unique=True)
    op.create_index(op.f("ix_match_dispositions_tenant_id"), "match_dispositions", ["tenant_id"], unique=False)

    op.create_table(
        "ingestion_health",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("source", sa.Enum("un", "ofac", "eu", "nacta", "pep", name="ingestionsource"), nullable=False),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("records_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source"),
    )
    op.create_index(op.f("ix_ingestion_health_source"), "ingestion_health", ["source"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_ingestion_health_source"), table_name="ingestion_health")
    op.drop_table("ingestion_health")
    op.drop_index(op.f("ix_match_dispositions_tenant_id"), table_name="match_dispositions")
    op.drop_index(op.f("ix_match_dispositions_screening_result_id"), table_name="match_dispositions")
    op.drop_table("match_dispositions")
    op.drop_index(op.f("ix_screening_results_tenant_id"), table_name="screening_results")
    op.drop_table("screening_results")
    op.drop_index(op.f("ix_watchlist_entries_primary_name"), table_name="watchlist_entries")
    op.drop_index(op.f("ix_watchlist_entries_source"), table_name="watchlist_entries")
    op.drop_table("watchlist_entries")
    op.execute("DROP TYPE IF EXISTS dispositionstatus")
    op.execute("DROP TYPE IF EXISTS overallstatus")
    op.execute("DROP TYPE IF EXISTS screeningtype")
    op.execute("DROP TYPE IF EXISTS entitytype")
    op.execute("DROP TYPE IF EXISTS watchlistsource")
    op.execute("DROP TYPE IF EXISTS ingestionsource")
