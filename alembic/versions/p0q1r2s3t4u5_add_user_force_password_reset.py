"""Add force_password_reset to users

Revision ID: p0q1r2s3t4u5
Revises: m4n5o6p7q8r9
Create Date: 2026-04-22

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migration_helpers import pg_column_exists

revision: str = "p0q1r2s3t4u5"
down_revision: Union[str, None] = "m4n5o6p7q8r9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not pg_column_exists("users", "force_password_reset"):
        op.add_column(
            "users",
            sa.Column(
                "force_password_reset",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )


def downgrade() -> None:
    if pg_column_exists("users", "force_password_reset"):
        op.drop_column("users", "force_password_reset")
