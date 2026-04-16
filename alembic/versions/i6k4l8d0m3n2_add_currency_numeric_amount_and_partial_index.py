"""Add currency field, numeric amount, and partial index for paid bills

Revision ID: i6k4l8d0m3n2
Revises: h5i3j7c9k2l3
Create Date: 2026-04-16 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'i6k4l8d0m3n2'
down_revision: Union[str, None] = 'h5i3j7c9k2l3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Add currency column
    op.add_column(
        'billings',
        sa.Column('currency', sa.String(length=10), nullable=False, server_default='INR')
    )

    # Alter amount column from Float to Numeric(10, 2)
    op.alter_column(
        'billings',
        'amount',
        existing_type=sa.Float(),
        type_=sa.Numeric(10, 2),
        existing_nullable=False
    )

    # Create partial index for paid bills only (PostgreSQL-specific)
    op.create_index(
        'idx_paid_bills_only',
        'billings',
        ['paid_at'],
        postgresql_where=sa.text("status = 'paid'")
    )


def downgrade():
    # Drop partial index
    op.drop_index('idx_paid_bills_only', table_name='billings')

    # Revert amount column to Float
    op.alter_column(
        'billings',
        'amount',
        existing_type=sa.Numeric(10, 2),
        type_=sa.Float(),
        existing_nullable=False
    )

    # Drop currency column
    op.drop_column('billings', 'currency')
