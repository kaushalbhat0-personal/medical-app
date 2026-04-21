"""Backfill tenant_id + seed user_tenant for existing users

Revision ID: n1b2a3c4k5l6
Revises: z9y8x7w6v5u4
Create Date: 2026-04-21

"""

from __future__ import annotations

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "n1b2a3c4k5l6"
down_revision: Union[str, None] = "z9y8x7w6v5u4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def upgrade() -> None:
    # Needed for gen_random_uuid()
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # Ensure default tenant exists (idempotent)
    op.execute(
        sa.text(
            """
            INSERT INTO tenants (id, name, type)
            VALUES (:tenant_id, 'Default Hospital', 'hospital')
            ON CONFLICT (id) DO NOTHING
            """
        ).bindparams(tenant_id=DEFAULT_TENANT_ID)
    )

    # Backfill tenant_id where NULL (idempotent)
    for table in ("patients", "appointments", "doctors", "billings"):
        op.execute(
            sa.text(
                f"""
                UPDATE {table}
                SET tenant_id = :tenant_id
                WHERE tenant_id IS NULL
                """
            ).bindparams(tenant_id=DEFAULT_TENANT_ID)
        )

    # Seed user_tenant for existing users (set-based, idempotent)
    op.execute(
        sa.text(
            """
            INSERT INTO user_tenant (id, user_id, tenant_id, role, is_primary)
            SELECT gen_random_uuid(), u.id, :tenant_id, COALESCE(u.role, 'admin'), true
            FROM users u
            WHERE NOT EXISTS (
                SELECT 1 FROM user_tenant ut WHERE ut.user_id = u.id
            )
            """
        ).bindparams(tenant_id=DEFAULT_TENANT_ID)
    )


def downgrade() -> None:
    # Best-effort reversal:
    # - only revert rows that still point at DEFAULT_TENANT_ID
    # - only delete seeded user_tenant rows for DEFAULT_TENANT_ID
    for table in ("patients", "appointments", "doctors", "billings"):
        op.execute(
            sa.text(
                f"""
                UPDATE {table}
                SET tenant_id = NULL
                WHERE tenant_id = :tenant_id
                """
            ).bindparams(tenant_id=DEFAULT_TENANT_ID)
        )

    op.execute(
        sa.text(
            """
            DELETE FROM user_tenant
            WHERE tenant_id = :tenant_id
              AND is_primary = true
            """
        ).bindparams(tenant_id=DEFAULT_TENANT_ID)
    )

