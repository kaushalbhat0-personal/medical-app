"""user role enum and updated_at

Revision ID: b7e1c0a2f4d8
Revises: a4f8c2e91b3d
Create Date: 2026-04-12

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b7e1c0a2f4d8"
down_revision: Union[str, None] = "a4f8c2e91b3d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    userrole = postgresql.ENUM("admin", "staff", name="userrole", create_type=True)
    userrole.create(bind, checkfirst=True)

    op.add_column(
        "users",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.execute(
        sa.text(
            "ALTER TABLE users ALTER COLUMN role TYPE userrole "
            "USING role::text::userrole"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    op.execute(
        sa.text(
            "ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(64) "
            "USING role::text"
        )
    )
    op.drop_column("users", "updated_at")
    postgresql.ENUM("admin", "staff", name="userrole", create_type=False).drop(
        bind, checkfirst=True
    )
