"""add team invites

Revision ID: 007
Revises: 006
Create Date: 2026-02-22
"""
from alembic import op
import sqlalchemy as sa

revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'team_invites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='member'),
        sa.Column('token', sa.String(255), nullable=False),
        sa.Column('accepted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token'),
    )
    op.create_index('ix_team_invites_id', 'team_invites', ['id'])
    op.create_index('ix_team_invites_owner_id', 'team_invites', ['owner_id'])
    op.create_index('ix_team_invites_email', 'team_invites', ['email'])


def downgrade():
    op.drop_index('ix_team_invites_email', 'team_invites')
    op.drop_index('ix_team_invites_owner_id', 'team_invites')
    op.drop_index('ix_team_invites_id', 'team_invites')
    op.drop_table('team_invites')
