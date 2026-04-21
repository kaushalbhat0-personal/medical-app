"""Appointment tenant/patient/created_at index; billings tenant matches appointment (composite FK)

Revision ID: t8u9v0w1x2y3
Revises: r2s3t4u5v6w7
Create Date: 2026-04-22

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "t8u9v0w1x2y3"
down_revision: Union[str, None] = "r2s3t4u5v6w7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- 1) Replace narrow (tenant_id, patient_id) index with sort-friendly covering index
    op.execute(sa.text("DROP INDEX IF EXISTS ix_appointments_tenant_patient"))
    op.execute(
        sa.text(
            """
            CREATE INDEX IF NOT EXISTS ix_appointments_tenant_patient_created
            ON appointments (tenant_id, patient_id, created_at DESC)
            WHERE is_deleted = false
            """
        )
    )

    # --- 2) DB guard: billing.tenant_id must match linked appointment.tenant_id when set
    # PostgreSQL CHECK cannot reference other tables; use composite FK instead.
    op.execute(
        sa.text(
            """
            UPDATE billings b
            SET tenant_id = a.tenant_id
            FROM appointments a
            WHERE b.appointment_id = a.id
              AND (b.tenant_id IS DISTINCT FROM a.tenant_id)
            """
        )
    )

    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_id_tenant "
            "ON appointments (id, tenant_id)"
        )
    )

    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
              ALTER TABLE billings
              ADD CONSTRAINT fk_billings_appointment_tenant_match
              FOREIGN KEY (appointment_id, tenant_id)
              REFERENCES appointments (id, tenant_id)
              ON DELETE CASCADE;
            EXCEPTION
              WHEN duplicate_object THEN
                NULL;
            END $$;
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text("ALTER TABLE billings DROP CONSTRAINT IF EXISTS fk_billings_appointment_tenant_match")
    )
    op.execute(sa.text("DROP INDEX IF EXISTS uq_appointments_id_tenant"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_appointments_tenant_patient_created"))
    op.execute(
        sa.text(
            """
            CREATE INDEX IF NOT EXISTS ix_appointments_tenant_patient
            ON appointments (tenant_id, patient_id)
            WHERE is_deleted = false
            """
        )
    )
