"""add is_deleted and indexes to appointments

Revision ID: 0f11ad4d06d4
Revises: g4h2i6b8j0k1
Create Date: 2026-04-16 13:42:01.802603

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from migration_helpers import pg_column_exists, pg_index_exists

# revision identifiers, used by Alembic.
revision: str = '0f11ad4d06d4'
down_revision: Union[str, None] = 'g4h2i6b8j0k1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    if not pg_column_exists("appointments", "is_deleted"):
        op.add_column(
            "appointments",
            sa.Column(
                "is_deleted",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )

    if not pg_index_exists("idx_active_appointments"):
        op.create_index(
            "idx_active_appointments",
            "appointments",
            ["is_deleted"],
        )

    if not pg_index_exists("idx_user_doctor_time"):
        op.create_index(
            "idx_user_doctor_time",
            "appointments",
            ["created_by", "doctor_id", "appointment_time"],
        )

def downgrade():
    if pg_index_exists("idx_user_doctor_time"):
        op.drop_index("idx_user_doctor_time", table_name="appointments")
    if pg_index_exists("idx_active_appointments"):
        op.drop_index("idx_active_appointments", table_name="appointments")
    if pg_column_exists("appointments", "is_deleted"):
        op.drop_column("appointments", "is_deleted")
