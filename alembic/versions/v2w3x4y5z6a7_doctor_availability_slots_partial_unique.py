"""Doctor availability + time off; partial unique on active appointment slots

Revision ID: v2w3x4y5z6a7
Revises: t8u9v0w1x2y3
Create Date: 2026-04-22

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "v2w3x4y5z6a7"
down_revision: Union[str, None] = "t8u9v0w1x2y3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "doctor_availability",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("slot_duration", sa.Integer(), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "doctor_id",
            "day_of_week",
            "start_time",
            "end_time",
            name="uq_doctor_availability_window",
        ),
    )
    op.create_index("ix_doctor_availability_doctor_id", "doctor_availability", ["doctor_id"])
    op.create_index("ix_doctor_availability_tenant_id", "doctor_availability", ["tenant_id"])

    op.create_table(
        "doctor_time_off",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("off_date", sa.Date(), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("doctor_id", "off_date", name="uq_doctor_time_off_day"),
    )
    op.create_index("ix_doctor_time_off_doctor_id", "doctor_time_off", ["doctor_id"])
    op.create_index("ix_doctor_time_off_off_date", "doctor_time_off", ["off_date"])
    op.create_index("ix_doctor_time_off_tenant_id", "doctor_time_off", ["tenant_id"])

    # Default Mon–Fri 09:00–17:00 UTC, 30-minute slots for existing active doctors (additive onboarding).
    op.execute(
        sa.text(
            """
            INSERT INTO doctor_availability (id, doctor_id, day_of_week, start_time, end_time, slot_duration, tenant_id)
            SELECT gen_random_uuid(), d.id, gs.dow, TIME '09:00', TIME '17:00', 30, d.tenant_id
            FROM doctors d
            CROSS JOIN (VALUES (0), (1), (2), (3), (4)) AS gs(dow)
            WHERE d.is_deleted = false AND d.is_active = true
            """
        )
    )

    op.drop_constraint("uq_doctor_time", "appointments", type_="unique")
    op.create_index(
        "uq_appointments_doctor_time_active",
        "appointments",
        ["doctor_id", "appointment_time"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false AND status <> 'cancelled'::appointmentstatus"),
    )


def downgrade() -> None:
    op.drop_index("uq_appointments_doctor_time_active", table_name="appointments")
    op.create_unique_constraint("uq_doctor_time", "appointments", ["doctor_id", "appointment_time"])

    op.drop_index("ix_doctor_time_off_tenant_id", table_name="doctor_time_off")
    op.drop_index("ix_doctor_time_off_off_date", table_name="doctor_time_off")
    op.drop_index("ix_doctor_time_off_doctor_id", table_name="doctor_time_off")
    op.drop_table("doctor_time_off")

    op.drop_index("ix_doctor_availability_tenant_id", table_name="doctor_availability")
    op.drop_index("ix_doctor_availability_doctor_id", table_name="doctor_availability")
    op.drop_table("doctor_availability")
