"""Add idempotency key, soft delete, and billing events table

Revision ID: j7l5m9e1n4o3
Revises: i6k4l8d0m3n2
Create Date: 2026-04-16 16:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'j7l5m9e1n4o3'
down_revision: Union[str, None] = 'i6k4l8d0m3n2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Add idempotency_key to billings
    op.add_column(
        'billings',
        sa.Column('idempotency_key', sa.String(length=255), nullable=True)
    )
    op.create_unique_constraint('uq_billing_idempotency_key', 'billings', ['idempotency_key'])

    # Add is_deleted to billings
    op.add_column(
        'billings',
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false')
    )
    op.create_index('idx_billing_is_deleted', 'billings', ['is_deleted'])

    # Create billing_events table
    op.create_table(
        'billing_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column('billing_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('billings.id', ondelete='CASCADE'), nullable=False),
        sa.Column('previous_status', sa.String(length=50), nullable=True),
        sa.Column('new_status', sa.String(length=50), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('event_metadata', sa.String(length=500), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Create indexes for billing_events
    op.create_index('idx_billing_events_billing_id', 'billing_events', ['billing_id'])
    op.create_index('idx_billing_events_created_at', 'billing_events', ['created_at'])


def downgrade():
    # Drop billing_events table and indexes
    op.drop_index('idx_billing_events_created_at', table_name='billing_events')
    op.drop_index('idx_billing_events_billing_id', table_name='billing_events')
    op.drop_table('billing_events')

    # Drop is_deleted from billings
    op.drop_index('idx_billing_is_deleted', table_name='billings')
    op.drop_column('billings', 'is_deleted')

    # Drop idempotency_key from billings
    op.drop_constraint('uq_billing_idempotency_key', 'billings', type_='unique')
    op.drop_column('billings', 'idempotency_key')
