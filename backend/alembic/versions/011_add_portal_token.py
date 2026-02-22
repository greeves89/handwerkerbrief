"""add portal_token to documents

Revision ID: 011_add_portal_token
Revises: 010_add_archive
Create Date: 2026-02-22
"""
from alembic import op
import sqlalchemy as sa

revision = '011_add_portal_token'
down_revision = '010_add_archive'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "documents",
        sa.Column("portal_token", sa.String(64), nullable=True, unique=True),
    )
    op.create_index("ix_documents_portal_token", "documents", ["portal_token"], unique=True)


def downgrade():
    op.drop_index("ix_documents_portal_token", table_name="documents")
    op.drop_column("documents", "portal_token")
