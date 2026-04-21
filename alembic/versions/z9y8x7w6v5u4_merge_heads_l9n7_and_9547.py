"""Merge alembic heads (tenant + billing due_date)

Revision ID: z9y8x7w6v5u4
Revises: 9547d90e5eed, m1t2n3t4e5n6
Create Date: 2026-04-21

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "z9y8x7w6v5u4"
down_revision: Union[str, tuple[str, str], None] = ("9547d90e5eed", "m1t2n3t4e5n6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Merge revision: no-op
    pass


def downgrade() -> None:
    # Merge revision: no-op
    pass

