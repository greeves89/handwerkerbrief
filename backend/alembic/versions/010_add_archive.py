"""add gobd archive

Revision ID: 010_add_archive
Revises: 009_add_site_reports
Create Date: 2026-02-22
"""
from alembic import op
import sqlalchemy as sa

revision = '010_add_archive'
down_revision = '009_add_site_reports'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "archive_entries",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_type", sa.String(50), nullable=False),
        sa.Column("document_number", sa.String(100), nullable=True),
        sa.Column("document_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("document_id", sa.Integer, sa.ForeignKey("documents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("counterparty", sa.String(255), nullable=True),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=True),
        sa.Column("file_size_bytes", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("mime_type", sa.String(100), nullable=False, server_default="application/pdf"),
        sa.Column("sha256_hash", sa.String(64), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("retention_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_locked", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("year", sa.Integer, nullable=True),
        sa.Column("amount_cents", sa.BigInteger, nullable=True),
    )
    op.create_index("ix_archive_entries_user_id", "archive_entries", ["user_id"])
    op.create_index("ix_archive_entries_document_number", "archive_entries", ["document_number"])
    op.create_index("ix_archive_entries_year", "archive_entries", ["year"])


def downgrade():
    op.drop_table("archive_entries")
