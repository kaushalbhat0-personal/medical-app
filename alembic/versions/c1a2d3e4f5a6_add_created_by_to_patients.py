"""add created_by to patients

Revision ID: c1a2d3e4f5a6
Revises: d9e8f7a6b5c4
Create Date: 2026-04-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from migration_helpers import pg_column_exists

revision: str = "c1a2d3e4f5a6"
down_revision: Union[str, None] = "d9e8f7a6b5c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not pg_column_exists("patients", "created_by"):
        op.add_column(
            "patients",
            sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        )

    bind = op.get_bind()
    first_user_id = bind.execute(
        sa.text("SELECT id FROM users ORDER BY created_at ASC LIMIT 1")
    ).scalar()

    if first_user_id is not None:
        bind.execute(
            sa.text(
                "UPDATE patients SET created_by = :user_id WHERE created_by IS NULL"
            ),
            {"user_id": first_user_id},
        )

    remaining_nulls = bind.execute(
        sa.text("SELECT COUNT(*) FROM patients WHERE created_by IS NULL")
    ).scalar_one()
    if remaining_nulls > 0:
        raise RuntimeError(
            "Cannot enforce NOT NULL on patients.created_by because some rows "
            "have no value and no users exist to backfill from. "
            "Create a user and update patients.created_by, then rerun migration."
        )

    op.alter_column("patients", "created_by", nullable=False)


def downgrade() -> None:
    if pg_column_exists("patients", "created_by"):
        op.drop_column("patients", "created_by")
