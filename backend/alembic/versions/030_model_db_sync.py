"""Sync models with database: missing columns, indexes, enum values, FK drift.

Revision ID: 030
Revises: 029
Create Date: 2026-04-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision: str = "030"
down_revision: Union[str, None] = "029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table: str, column: str) -> bool:
    r = conn.execute(text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name=:t AND column_name=:c"
    ), {"t": table, "c": column})
    return r.scalar() is not None


def _index_exists(conn, name: str) -> bool:
    r = conn.execute(text(
        "SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=:n"
    ), {"n": name})
    return r.scalar() is not None


def _constraint_exists(conn, name: str) -> bool:
    r = conn.execute(text(
        "SELECT 1 FROM pg_constraint WHERE conname=:n"
    ), {"n": name})
    return r.scalar() is not None


def _enum_value_exists(conn, enum_name: str, value: str) -> bool:
    r = conn.execute(text(
        "SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid "
        "WHERE t.typname = :enum AND e.enumlabel = :val"
    ), {"enum": enum_name, "val": value})
    return r.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    # -----------------------------------------------------------------------
    # 1. identity_documents: add content_type, file_size_bytes columns
    # -----------------------------------------------------------------------
    if not _column_exists(conn, "identity_documents", "content_type"):
        op.add_column("identity_documents",
            sa.Column("content_type", sa.String(128), nullable=False, server_default="application/octet-stream"))
        # Remove server_default after backfill
        op.alter_column("identity_documents", "content_type", server_default=None)

    if not _column_exists(conn, "identity_documents", "file_size_bytes"):
        op.add_column("identity_documents",
            sa.Column("file_size_bytes", sa.Integer(), nullable=False, server_default="0"))
        op.alter_column("identity_documents", "file_size_bytes", server_default=None)

    # 2. identity_documents: extend document_type enum with new values
    #    Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction.
    #    We check first, then only add if missing.
    for val in ("selfie", "proof_of_address", "bank_statement"):
        # Check against whichever enum name exists
        for ename in ("documenttype", "identity_documenttype"):
            if _enum_value_exists(conn, ename, val):
                break
        else:
            # Value not found in either enum — add to documenttype (current name)
            conn.execute(text("COMMIT"))
            conn.execute(text(f"ALTER TYPE documenttype ADD VALUE IF NOT EXISTS '{val}'"))
            conn.execute(text("BEGIN"))

    # -----------------------------------------------------------------------
    # 3. audit_log: add missing indexes on resource_id, user_id
    # -----------------------------------------------------------------------
    if not _index_exists(conn, "ix_audit_log_resource_id"):
        op.create_index("ix_audit_log_resource_id", "audit_log", ["resource_id"])
    if not _index_exists(conn, "ix_audit_log_user_id"):
        op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])

    # -----------------------------------------------------------------------
    # 4. case_notes: add missing index on user_id
    # -----------------------------------------------------------------------
    if not _index_exists(conn, "ix_case_notes_user_id"):
        op.create_index("ix_case_notes_user_id", "case_notes", ["user_id"])

    # -----------------------------------------------------------------------
    # 5. cases: add missing index on assigned_to
    # -----------------------------------------------------------------------
    if not _index_exists(conn, "ix_cases_assigned_to"):
        op.create_index("ix_cases_assigned_to", "cases", ["assigned_to"])

    # -----------------------------------------------------------------------
    # 6. edd_cases: change customer_id index from unique to non-unique
    #    (multiple EDD cases per customer should be allowed)
    # -----------------------------------------------------------------------
    if _index_exists(conn, "ix_edd_cases_customer_id"):
        # Check if current index is unique
        r = conn.execute(text(
            "SELECT indisunique FROM pg_index i JOIN pg_class c ON i.indexrelid = c.oid "
            "WHERE c.relname = 'ix_edd_cases_customer_id'"
        ))
        row = r.fetchone()
        if row and row[0]:  # is unique — rebuild as non-unique
            op.drop_index("ix_edd_cases_customer_id", table_name="edd_cases")
            op.create_index("ix_edd_cases_customer_id", "edd_cases", ["customer_id"], unique=False)

    # -----------------------------------------------------------------------
    # 7. monitoring_rules: add indexes on rule_type, severity; drop old enabled index
    # -----------------------------------------------------------------------
    if not _index_exists(conn, "ix_monitoring_rules_rule_type"):
        op.create_index("ix_monitoring_rules_rule_type", "monitoring_rules", ["rule_type"])
    if not _index_exists(conn, "ix_monitoring_rules_severity"):
        op.create_index("ix_monitoring_rules_severity", "monitoring_rules", ["severity"])
    if _index_exists(conn, "ix_monitoring_rules_enabled"):
        op.drop_index("ix_monitoring_rules_enabled", table_name="monitoring_rules")

    # -----------------------------------------------------------------------
    # 8. wallet_risk_scores: add index on confidence_level; drop old created_at index
    # -----------------------------------------------------------------------
    if not _index_exists(conn, "ix_wallet_risk_scores_confidence_level"):
        op.create_index("ix_wallet_risk_scores_confidence_level", "wallet_risk_scores", ["confidence_level"])
    if _index_exists(conn, "ix_wallet_risk_scores_created_at"):
        op.drop_index("ix_wallet_risk_scores_created_at", table_name="wallet_risk_scores")

    # -----------------------------------------------------------------------
    # 9. wallets: drop stale monitoring_enabled index (029 may have failed to create it
    #    or model no longer declares it)
    # -----------------------------------------------------------------------
    if _index_exists(conn, "ix_wallets_monitoring_enabled"):
        op.drop_index("ix_wallets_monitoring_enabled", table_name="wallets")

    # -----------------------------------------------------------------------
    # 10. usage_events: drop old created_at index (not in model)
    # -----------------------------------------------------------------------
    if _index_exists(conn, "ix_usage_events_created_at"):
        op.drop_index("ix_usage_events_created_at", table_name="usage_events")

    # -----------------------------------------------------------------------
    # 11. ingestion_health: drop old unique source index (not in model)
    # -----------------------------------------------------------------------
    if _index_exists(conn, "ix_ingestion_health_source"):
        op.drop_index("ix_ingestion_health_source", table_name="ingestion_health")

    # -----------------------------------------------------------------------
    # 12. FK drift: monitoring_rules.tenant_id — model has no ondelete,
    #     DB has ondelete CASCADE. Drop old FK, re-add without CASCADE.
    # -----------------------------------------------------------------------
    if _constraint_exists(conn, "monitoring_rules_tenant_id_fkey"):
        op.drop_constraint("monitoring_rules_tenant_id_fkey", "monitoring_rules", type_="foreignkey")
    # Model declares tenant_id as nullable with no FK constraint (just an index),
    # so we leave it as a plain indexed column — no FK to re-add.

    # cases.tenant_id — model has no FK, DB has FK with CASCADE
    if _constraint_exists(conn, "cases_tenant_id_fkey"):
        op.drop_constraint("cases_tenant_id_fkey", "cases", type_="foreignkey")

    # shufti_pending_verifications.tenant_id — model FK without ondelete vs DB CASCADE
    if _constraint_exists(conn, "shufti_pending_verifications_tenant_id_fkey"):
        op.drop_constraint("shufti_pending_verifications_tenant_id_fkey",
                           "shufti_pending_verifications", type_="foreignkey")
        op.create_foreign_key(
            "shufti_pending_verifications_tenant_id_fkey",
            "shufti_pending_verifications", "tenants",
            ["tenant_id"], ["id"],
        )

    # usage_events.tenant_id — same pattern
    if _constraint_exists(conn, "usage_events_tenant_id_fkey"):
        op.drop_constraint("usage_events_tenant_id_fkey", "usage_events", type_="foreignkey")
        op.create_foreign_key(
            "usage_events_tenant_id_fkey",
            "usage_events", "tenants",
            ["tenant_id"], ["id"],
        )

    # match_dispositions.screening_result_id — remove unique constraint, re-add FK without CASCADE
    if _constraint_exists(conn, "match_dispositions_screening_result_id_key"):
        op.drop_constraint("match_dispositions_screening_result_id_key",
                           "match_dispositions", type_="unique")
    if _constraint_exists(conn, "match_dispositions_screening_result_id_fkey"):
        op.drop_constraint("match_dispositions_screening_result_id_fkey",
                           "match_dispositions", type_="foreignkey")
        op.create_foreign_key(
            "match_dispositions_screening_result_id_fkey",
            "match_dispositions", "screening_results",
            ["screening_result_id"], ["id"],
        )

    # -----------------------------------------------------------------------
    # 13. Rename document_type enum from 'documenttype' to 'identity_documenttype'
    # -----------------------------------------------------------------------
    r = conn.execute(text("SELECT 1 FROM pg_type WHERE typname = 'documenttype'"))
    if r.scalar() is not None:
        r2 = conn.execute(text("SELECT 1 FROM pg_type WHERE typname = 'identity_documenttype'"))
        if r2.scalar() is None:
            op.execute("ALTER TYPE documenttype RENAME TO identity_documenttype")

    # -----------------------------------------------------------------------
    # 14. shufti_pending_verifications.reference: VARCHAR(250) -> VARCHAR(128)
    # -----------------------------------------------------------------------
    op.alter_column(
        "shufti_pending_verifications", "reference",
        type_=sa.String(128),
        existing_type=sa.String(250),
        existing_nullable=False,
    )

    # -----------------------------------------------------------------------
    # 15. Remove stale unique constraints (model doesn't declare them)
    # -----------------------------------------------------------------------
    if _constraint_exists(conn, "tenants_slug_key"):
        op.drop_constraint("tenants_slug_key", "tenants", type_="unique")
    if _constraint_exists(conn, "users_email_key"):
        op.drop_constraint("users_email_key", "users", type_="unique")


def downgrade() -> None:
    conn = op.get_bind()

    # Re-add unique constraints
    op.create_unique_constraint("users_email_key", "users", ["email"])
    op.create_unique_constraint("tenants_slug_key", "tenants", ["slug"])

    # Restore FK constraints to CASCADE versions
    if _constraint_exists(conn, "match_dispositions_screening_result_id_fkey"):
        op.drop_constraint("match_dispositions_screening_result_id_fkey",
                           "match_dispositions", type_="foreignkey")
    op.create_foreign_key(
        "match_dispositions_screening_result_id_fkey",
        "match_dispositions", "screening_results",
        ["screening_result_id"], ["id"], ondelete="CASCADE",
    )
    op.create_unique_constraint("match_dispositions_screening_result_id_key",
                                "match_dispositions", ["screening_result_id"])

    if _constraint_exists(conn, "usage_events_tenant_id_fkey"):
        op.drop_constraint("usage_events_tenant_id_fkey", "usage_events", type_="foreignkey")
    op.create_foreign_key(
        "usage_events_tenant_id_fkey",
        "usage_events", "tenants",
        ["tenant_id"], ["id"], ondelete="CASCADE",
    )

    if _constraint_exists(conn, "shufti_pending_verifications_tenant_id_fkey"):
        op.drop_constraint("shufti_pending_verifications_tenant_id_fkey",
                           "shufti_pending_verifications", type_="foreignkey")
    op.create_foreign_key(
        "shufti_pending_verifications_tenant_id_fkey",
        "shufti_pending_verifications", "tenants",
        ["tenant_id"], ["id"], ondelete="CASCADE",
    )

    op.create_foreign_key(
        "cases_tenant_id_fkey",
        "cases", "tenants",
        ["tenant_id"], ["id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "monitoring_rules_tenant_id_fkey",
        "monitoring_rules", "tenants",
        ["tenant_id"], ["id"], ondelete="CASCADE",
    )

    # Restore old indexes
    op.create_index("ix_usage_events_created_at", "usage_events", ["created_at"])
    op.create_index("ix_wallet_risk_scores_created_at", "wallet_risk_scores", ["created_at"])
    op.create_index("ix_wallets_monitoring_enabled", "wallets", ["monitoring_enabled"])
    op.create_index("ix_monitoring_rules_enabled", "monitoring_rules", ["enabled"])
    op.create_index("ix_ingestion_health_source", "ingestion_health", ["source"], unique=True)

    # Drop new indexes
    if _index_exists(conn, "ix_monitoring_rules_severity"):
        op.drop_index("ix_monitoring_rules_severity", table_name="monitoring_rules")
    if _index_exists(conn, "ix_monitoring_rules_rule_type"):
        op.drop_index("ix_monitoring_rules_rule_type", table_name="monitoring_rules")
    if _index_exists(conn, "ix_wallet_risk_scores_confidence_level"):
        op.drop_index("ix_wallet_risk_scores_confidence_level", table_name="wallet_risk_scores")

    # Restore edd_cases unique index
    if _index_exists(conn, "ix_edd_cases_customer_id"):
        op.drop_index("ix_edd_cases_customer_id", table_name="edd_cases")
    op.create_index("ix_edd_cases_customer_id", "edd_cases", ["customer_id"], unique=True)

    if _index_exists(conn, "ix_cases_assigned_to"):
        op.drop_index("ix_cases_assigned_to", table_name="cases")
    if _index_exists(conn, "ix_case_notes_user_id"):
        op.drop_index("ix_case_notes_user_id", table_name="case_notes")
    if _index_exists(conn, "ix_audit_log_user_id"):
        op.drop_index("ix_audit_log_user_id", table_name="audit_log")
    if _index_exists(conn, "ix_audit_log_resource_id"):
        op.drop_index("ix_audit_log_resource_id", table_name="audit_log")

    # Revert shufti reference column length
    op.alter_column(
        "shufti_pending_verifications", "reference",
        type_=sa.String(250),
        existing_type=sa.String(128),
        existing_nullable=False,
    )

    # Rename enum back (only if documenttype doesn't already exist)
    r1 = conn.execute(text("SELECT 1 FROM pg_type WHERE typname = 'identity_documenttype'"))
    r2 = conn.execute(text("SELECT 1 FROM pg_type WHERE typname = 'documenttype'"))
    if r1.scalar() is not None and r2.scalar() is None:
        op.execute("ALTER TYPE identity_documenttype RENAME TO documenttype")
    elif r1.scalar() is not None and r2.scalar() is not None:
        # Both exist — drop the identity_documenttype orphan
        op.execute("DROP TYPE IF EXISTS identity_documenttype")

    # Drop new columns
    op.drop_column("identity_documents", "file_size_bytes")
    op.drop_column("identity_documents", "content_type")
