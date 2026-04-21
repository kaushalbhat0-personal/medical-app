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

    # Seed user_tenant for existing users:
    # - one primary association per user (if user has none yet)
    # - role mirrors users.role
    conn = op.get_bind()

    users = list(
        conn.execute(sa.text("SELECT id, role FROM users")).mappings().all()
    )
    for row in users:
        user_id = row["id"]
        role = row["role"] or "admin"

        exists = conn.execute(
            sa.text(
                """
                SELECT 1
                FROM user_tenant
                WHERE user_id = :user_id
                LIMIT 1
                """
            ),
            {"user_id": user_id},
        ).first()
        if exists:
            continue

        conn.execute(
            sa.text(
                """
                INSERT INTO user_tenant (id, user_id, tenant_id, role, is_primary)
                VALUES (:id, :user_id, :tenant_id, :role, true)
                """
            ),
            {
                "id": uuid.uuid4(),
                "user_id": user_id,
                "tenant_id": DEFAULT_TENANT_ID,
                "role": role,
            },
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

