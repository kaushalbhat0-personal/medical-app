"""Add is_active/is_deleted flags to doctors (public listing hardening)

Revision ID: a1b2c3d4e5f6
Revises: u8v9w0x1y2z3
Create Date: 2026-04-21

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "u8v9w0x1y2z3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "doctors",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "doctors",
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_doctors_is_active", "doctors", ["is_active"], unique=False)
    op.create_index("ix_doctors_is_deleted", "doctors", ["is_deleted"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_doctors_is_deleted", table_name="doctors")
    op.drop_index("ix_doctors_is_active", table_name="doctors")
    op.drop_column("doctors", "is_deleted")
    op.drop_column("doctors", "is_active")

