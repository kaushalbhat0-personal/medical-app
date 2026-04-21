"""Add user_id to doctors and patients (nullable, unique) + backfill

Revision ID: p2q3r4s5t6u7
Revises: n1b2a3c4k5l6
Create Date: 2026-04-21

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "p2q3r4s5t6u7"
down_revision: Union[str, None] = "n1b2a3c4k5l6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add nullable user_id columns (safe, backward compatible)
    op.add_column(
        "doctors",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "patients",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # Unique indexes (Postgres allows multiple NULLs in UNIQUE indexes)
    op.create_index("ix_doctors_user_id", "doctors", ["user_id"], unique=True)
    op.create_index("ix_patients_user_id", "patients", ["user_id"], unique=True)

    # Backfill only when legacy assumption holds (doctor.id == user.id / patient.id == user.id)
    # This is safe and does not touch rows that don't match.
    op.execute(
        sa.text(
            """
            UPDATE doctors d
            SET user_id = d.id
            WHERE d.user_id IS NULL
              AND EXISTS (SELECT 1 FROM users u WHERE u.id = d.id)
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE patients p
            SET user_id = p.id
            WHERE p.user_id IS NULL
              AND EXISTS (SELECT 1 FROM users u WHERE u.id = p.id)
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_patients_user_id", table_name="patients")
    op.drop_index("ix_doctors_user_id", table_name="doctors")
    op.drop_column("patients", "user_id")
    op.drop_column("doctors", "user_id")

