"""Enforce doctors tenant_id via CHECK + add appointments tenant/patient index

Revision ID: f6e5d4c3b2a1
Revises: a1b2c3d4e5f6
Create Date: 2026-04-21

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f6e5d4c3b2a1"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1) doctors.tenant_id must be present (safe rollout via NOT VALID then VALIDATE)
    # Idempotent constraint creation (Postgres doesn't support IF NOT EXISTS for constraints)
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
              ALTER TABLE doctors
              ADD CONSTRAINT ck_doctors_tenant_id_not_null
              CHECK (tenant_id IS NOT NULL)
              NOT VALID;
            EXCEPTION
              WHEN duplicate_object THEN
                NULL;
            END $$;
            """
        )
    )

    # Audit/guard: if dirty rows exist, backfill them before validation.
    # Deterministic fallback tenant used only to allow safe rollout.
    # NOTE: this does not change the column nullability; it just repairs legacy rows.
    null_count = bind.execute(sa.text("SELECT COUNT(*) FROM doctors WHERE tenant_id IS NULL")).scalar() or 0
    if int(null_count) > 0:
        default_tenant_id = "00000000-0000-0000-0000-000000000001"
        bind.execute(
            sa.text(
                """
                UPDATE doctors
                SET tenant_id = :tenant_id
                WHERE tenant_id IS NULL
                """
            ).bindparams(tenant_id=default_tenant_id)
        )

    op.execute(sa.text("ALTER TABLE doctors VALIDATE CONSTRAINT ck_doctors_tenant_id_not_null"))

    # 2) Patient listing perf: tenant+patient partial index (appointments join)
    op.execute(
        sa.text(
            """
            CREATE INDEX IF NOT EXISTS ix_appointments_tenant_patient
            ON appointments (tenant_id, patient_id)
            WHERE is_deleted = false
            """
        )
    )
    # Companion index for doctor dashboards and doctor-scoped queries
    op.execute(
        sa.text(
            """
            CREATE INDEX IF NOT EXISTS ix_appointments_tenant_doctor
            ON appointments (tenant_id, doctor_id)
            WHERE is_deleted = false
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_appointments_tenant_doctor"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_appointments_tenant_patient"))
    op.execute(sa.text("ALTER TABLE doctors DROP CONSTRAINT IF EXISTS ck_doctors_tenant_id_not_null"))

