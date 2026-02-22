"""add work assignments

Revision ID: 008
Revises: 007
Create Date: 2026-02-22
"""
from alembic import op
import sqlalchemy as sa

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'work_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('worker_name', sa.String(255), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('location', sa.String(255), nullable=True),
        sa.Column('assignment_date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=True),
        sa.Column('end_time', sa.Time(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='planned'),
        sa.Column('color', sa.String(20), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_work_assignments_id', 'work_assignments', ['id'])
    op.create_index('ix_work_assignments_user_id', 'work_assignments', ['user_id'])
    op.create_index('ix_work_assignments_assignment_date', 'work_assignments', ['assignment_date'])


def downgrade():
    op.drop_index('ix_work_assignments_assignment_date', 'work_assignments')
    op.drop_index('ix_work_assignments_user_id', 'work_assignments')
    op.drop_index('ix_work_assignments_id', 'work_assignments')
    op.drop_table('work_assignments')
