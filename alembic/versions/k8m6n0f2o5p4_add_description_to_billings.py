"""Add description to billings

Revision ID: k8m6n0f2o5p4
Revises: j7l5m9e1n4o3
Create Date: 2026-04-20 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from migration_helpers import pg_column_exists

# revision identifiers, used by Alembic.
revision: str = 'k8m6n0f2o5p4'
down_revision: Union[str, None] = 'j7l5m9e1n4o3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add description column to billings table
    if not pg_column_exists('billings', 'description'):
        op.add_column('billings', sa.Column('description', sa.String(500), nullable=True))


def downgrade() -> None:
    # Remove description column from billings table
    if pg_column_exists('billings', 'description'):
        op.drop_column('billings', 'description')
