"""Billing active appointment uniqueness, doctor tenant NOT NULL, appointment idempotency

Revision ID: r2s3t4u5v6w7
Revises: f6e5d4c3b2a1
Create Date: 2026-04-22

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "r2s3t4u5v6w7"
down_revision: Union[str, None] = "f6e5d4c3b2a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # --- 1.1 Replace billing appointment uniqueness with partial index (active rows only)
    op.execute(sa.text("DROP INDEX IF EXISTS uq_billing_appointment"))

    op.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_active_appointment
            ON billings (appointment_id)
            WHERE appointment_id IS NOT NULL AND is_deleted = false
            """
        )
    )

    # --- 1.2 doctors.tenant_id NOT NULL (CHECK already enforced; column may still be nullable)
    null_doctors = bind.execute(sa.text("SELECT COUNT(*) FROM doctors WHERE tenant_id IS NULL")).scalar() or 0
    if int(null_doctors) > 0:
        raise RuntimeError(
            "Cannot set doctors.tenant_id NOT NULL: rows with NULL tenant_id still exist. "
            "Backfill tenant_id before running this migration."
        )

    op.alter_column(
        "doctors",
        "tenant_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
    op.execute(sa.text("ALTER TABLE doctors DROP CONSTRAINT IF EXISTS ck_doctors_tenant_id_not_null"))

    # --- 5 Appointment idempotency (anti-duplicate POST)
    op.create_table(
        "appointment_creation_idempotency",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "idempotency_key", name="uq_appointment_idempotency_user_key"),
    )
    op.create_index(
        "ix_appointment_idempotency_created_at",
        "appointment_creation_idempotency",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_appointment_idempotency_created_at", table_name="appointment_creation_idempotency")
    op.drop_table("appointment_creation_idempotency")

    # Restore CHECK (NOT VALID) pattern from prior migration — column stays NOT NULL
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
    op.alter_column(
        "doctors",
        "tenant_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )

    op.execute(sa.text("DROP INDEX IF EXISTS uq_billing_active_appointment"))
    op.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_appointment
            ON billings (appointment_id)
            WHERE appointment_id IS NOT NULL
            """
        )
    )
