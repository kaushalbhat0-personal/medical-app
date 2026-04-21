"""Add index on tenants.type (marketplace listing)

Revision ID: u8v9w0x1y2z3
Revises: p2q3r4s5t6u7
Create Date: 2026-04-21

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "u8v9w0x1y2z3"
down_revision: Union[str, None] = "p2q3r4s5t6u7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_tenants_type", "tenants", ["type"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_tenants_type", table_name="tenants")

