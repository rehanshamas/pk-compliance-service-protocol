"""Enforce audit_log immutability at the database level.

Revision ID: 019
Revises: 018
Create Date: 2026-03-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- 1. Trigger that prevents mutation for ALL roles ---
    # Note: cip_app restricted role + GRANT/REVOKE should be applied by a DBA
    # in production. The trigger below enforces immutability regardless of role.
    op.execute(
        "CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() "
        "RETURNS TRIGGER AS $t$ "
        "BEGIN "
        "RAISE EXCEPTION 'audit_log is append-only: % operations are forbidden', TG_OP; "
        "RETURN NULL; "
        "END; "
        "$t$ LANGUAGE plpgsql;"
    )

    op.execute(
        "DROP TRIGGER IF EXISTS audit_log_immutable ON audit_log;"
    )

    op.execute(
        "CREATE TRIGGER audit_log_immutable "
        "BEFORE UPDATE OR DELETE ON audit_log "
        "FOR EACH ROW "
        "EXECUTE FUNCTION prevent_audit_log_mutation();"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_log_immutable ON audit_log;")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_log_mutation();")
    # NOTE: We intentionally do NOT drop the cip_app role here, as it may
    # be in use by active connections or referenced by other grants.
