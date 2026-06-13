"""Identity documents table (Phase 4.3).

Revision ID: 006
Revises: 005
Create Date: 2026-03-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = __import__("sqlalchemy").inspect(conn)
    if "identity_documents" in inspector.get_table_names():
        return
    op.create_table(
        "identity_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "document_type",
            sa.Enum("cnic", "passport", "driving_license", name="identity_documenttype"),
            nullable=False,
        ),
        sa.Column("file_key", sa.String(512), nullable=False),
        sa.Column("content_type", sa.String(128), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("ocr_data", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_identity_documents_customer_id"), "identity_documents", ["customer_id"], unique=False
    )
    op.create_index(
        op.f("ix_identity_documents_tenant_id"), "identity_documents", ["tenant_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_identity_documents_tenant_id"), table_name="identity_documents")
    op.drop_index(op.f("ix_identity_documents_customer_id"), table_name="identity_documents")
    op.drop_table("identity_documents")
    op.execute("DROP TYPE IF EXISTS identity_documenttype")
