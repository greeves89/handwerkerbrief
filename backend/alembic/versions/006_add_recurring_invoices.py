"""add recurring invoices

Revision ID: 006
Revises: 005
Create Date: 2026-02-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'recurring_invoices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('interval', sa.String(20), nullable=False),
        sa.Column('next_date', sa.Date(), nullable=False),
        sa.Column('last_created_at', sa.Date(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('tax_rate', sa.Numeric(5, 2), nullable=False, server_default='19'),
        sa.Column('discount_percent', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.Column('payment_terms', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('items', JSON(), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_recurring_invoices_user_id', 'recurring_invoices', ['user_id'])
    op.create_index('ix_recurring_invoices_customer_id', 'recurring_invoices', ['customer_id'])


def downgrade():
    op.drop_index('ix_recurring_invoices_customer_id', 'recurring_invoices')
    op.drop_index('ix_recurring_invoices_user_id', 'recurring_invoices')
    op.drop_table('recurring_invoices')
