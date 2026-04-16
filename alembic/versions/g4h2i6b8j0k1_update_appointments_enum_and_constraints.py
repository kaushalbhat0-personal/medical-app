"""update appointments with enum status, unique constraint, and created_by

Revision ID: g4h2i6b8j0k1
Revises: f3b1d5a7e9c2
Create Date: 2026-04-16

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "g4h2i6b8j0k1"
down_revision: Union[str, None] = "f3b1d5a7e9c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the enum type first
    appointmentstatus = postgresql.ENUM(
        "scheduled", "completed", "cancelled",
        name="appointmentstatus",
        create_type=True,
    )
    appointmentstatus.create(op.get_bind(), checkfirst=True)

    # Add created_by column
    op.add_column(
        "appointments",
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    # Update existing rows to have a placeholder created_by value
    # (users should update this manually or through app logic)
    op.execute("UPDATE appointments SET created_by = '00000000-0000-0000-0000-000000000000'::uuid WHERE created_by IS NULL")

    # Make created_by non-nullable
    op.alter_column("appointments", "created_by", nullable=False)

    # Convert status column from String to Enum
    op.execute("ALTER TABLE appointments ALTER COLUMN status TYPE appointmentstatus USING status::appointmentstatus")

    # Drop the old non-unique index
    op.drop_index("ix_appointments_doctor_id_appointment_time", table_name="appointments")

    # Create the unique constraint
    op.create_unique_constraint(
        "uq_doctor_time",
        "appointments",
        ["doctor_id", "appointment_time"],
    )

    # Create composite index for user queries
    op.create_index(
        "idx_user_doctor_time",
        "appointments",
        ["created_by", "doctor_id", "appointment_time"],
    )

    # Add is_deleted column for soft delete
    op.add_column(
        "appointments",
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    # Create index for is_deleted to speed up filtered queries
    op.create_index(
        "idx_active_appointments",
        "appointments",
        ["is_deleted"],
    )


def downgrade() -> None:
    # Drop is_deleted index
    op.drop_index("idx_active_appointments", table_name="appointments")

    # Drop is_deleted column
    op.drop_column("appointments", "is_deleted")

    # Drop composite index
    op.drop_index("idx_user_doctor_time", table_name="appointments")

    # Drop the unique constraint
    op.drop_constraint("uq_doctor_time", "appointments", type_="unique")

    # Recreate the non-unique index
    op.create_index(
        "ix_appointments_doctor_id_appointment_time",
        "appointments",
        ["doctor_id", "appointment_time"],
        unique=False,
    )

    # Convert status column back to String
    op.alter_column(
        "appointments",
        "status",
        type_=sa.String(length=50),
        postgresql_using="status::text",
    )

    # Drop created_by column
    op.drop_column("appointments", "created_by")

    # Drop the enum type
    appointmentstatus = postgresql.ENUM(
        "scheduled", "completed", "cancelled",
        name="appointmentstatus",
    )
    appointmentstatus.drop(op.get_bind(), checkfirst=True)
