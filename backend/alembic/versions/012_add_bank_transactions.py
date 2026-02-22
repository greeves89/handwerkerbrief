"""add bank_transactions table

Revision ID: 012
Revises: 011
Create Date: 2026-02-22
"""
from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "bank_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("booking_date", sa.Date(), nullable=False),
        sa.Column("value_date", sa.Date(), nullable=True),
        sa.Column("counterparty", sa.String(255), nullable=True),
        sa.Column("iban", sa.String(40), nullable=True),
        sa.Column("purpose", sa.Text(), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False, server_default="EUR"),
        sa.Column("matched_document_id", sa.Integer(), sa.ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("match_confidence", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_manually_matched", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_ignored", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("import_batch", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade():
    op.drop_table("bank_transactions")
