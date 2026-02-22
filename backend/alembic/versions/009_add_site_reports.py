"""add site reports and photos

Revision ID: 009_add_site_reports
Revises: 008_add_work_assignments
Create Date: 2026-02-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = '009_add_site_reports'
down_revision = '008_add_work_assignments'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "site_reports",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("customer_id", sa.Integer, sa.ForeignKey("customers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("document_id", sa.Integer, sa.ForeignKey("documents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("location", sa.String(500), nullable=True),
        sa.Column("report_date", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("customer_signature", sa.Text, nullable=True),
        sa.Column("customer_name", sa.String(255), nullable=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("defects", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_site_reports_user_id", "site_reports", ["user_id"])

    op.create_table(
        "site_report_photos",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("report_id", sa.Integer, sa.ForeignKey("site_reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("original_name", sa.String(255), nullable=True),
        sa.Column("caption", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_site_report_photos_report_id", "site_report_photos", ["report_id"])


def downgrade():
    op.drop_table("site_report_photos")
    op.drop_table("site_reports")
