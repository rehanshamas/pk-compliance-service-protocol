"""StrReport table for goAML STR/CTR XML. Phase 5.3.

Revision ID: 012
Revises: 011
Create Date: 2026-03-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if "str_reports" in inspector.get_table_names():
        return

    for typ in ("strreporttype", "strfilingstatus"):
        r = conn.execute(sa.text(f"SELECT 1 FROM pg_type WHERE typname = '{typ}'"))
        if r.fetchone() is None:
            if typ == "strreporttype":
                op.execute("CREATE TYPE strreporttype AS ENUM ('str', 'ctr')")
            else:
                op.execute("CREATE TYPE strfilingstatus AS ENUM ('generated', 'exported', 'filed')")

    type_enum = postgresql.ENUM("str", "ctr", name="strreporttype", create_type=False)
    status_enum = postgresql.ENUM("generated", "exported", "filed", name="strfilingstatus", create_type=False)

    op.create_table(
        "str_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("isar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("report_type", type_enum, nullable=False, server_default="str"),
        sa.Column("goaml_xml", sa.Text(), nullable=False),
        sa.Column("goaml_schema_version", sa.String(32), nullable=False, server_default="1.0"),
        sa.Column("filing_status", status_enum, nullable=False, server_default="generated"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["isar_id"], ["isars.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_str_reports_tenant_id"), "str_reports", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_str_reports_isar_id"), "str_reports", ["isar_id"], unique=False)
    op.create_index(op.f("ix_str_reports_report_type"), "str_reports", ["report_type"], unique=False)
    op.create_index(op.f("ix_str_reports_filing_status"), "str_reports", ["filing_status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_str_reports_filing_status"), table_name="str_reports")
    op.drop_index(op.f("ix_str_reports_report_type"), table_name="str_reports")
    op.drop_index(op.f("ix_str_reports_isar_id"), table_name="str_reports")
    op.drop_index(op.f("ix_str_reports_tenant_id"), table_name="str_reports")
    op.drop_table("str_reports")
    op.execute("DROP TYPE IF EXISTS strfilingstatus")
    op.execute("DROP TYPE IF EXISTS strreporttype")
