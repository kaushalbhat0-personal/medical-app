"""Doctor timezone; partial doctor time off windows

Revision ID: m4n5o6p7q8r9
Revises: v2w3x4y5z6a7
Create Date: 2026-04-22

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migration_helpers import pg_column_exists

revision: str = "m4n5o6p7q8r9"
down_revision: Union[str, None] = "v2w3x4y5z6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not pg_column_exists("doctors", "timezone"):
        op.add_column(
            "doctors",
            sa.Column("timezone", sa.String(length=64), nullable=False, server_default="UTC"),
        )
    if not pg_column_exists("doctor_time_off", "start_time"):
        op.add_column("doctor_time_off", sa.Column("start_time", sa.Time(), nullable=True))
    if not pg_column_exists("doctor_time_off", "end_time"):
        op.add_column("doctor_time_off", sa.Column("end_time", sa.Time(), nullable=True))


def downgrade() -> None:
    if pg_column_exists("doctor_time_off", "end_time"):
        op.drop_column("doctor_time_off", "end_time")
    if pg_column_exists("doctor_time_off", "start_time"):
        op.drop_column("doctor_time_off", "start_time")
    if pg_column_exists("doctors", "timezone"):
        op.drop_column("doctors", "timezone")
