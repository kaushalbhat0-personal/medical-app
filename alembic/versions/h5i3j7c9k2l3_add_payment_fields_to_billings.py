"""create billings table with payment fields

Revision ID: h5i3j7c9k2l3
Revises: 0f11ad4d06d4
Create Date: 2026-04-16 16:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'h5i3j7c9k2l3'
down_revision: Union[str, None] = '0f11ad4d06d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Create billings table (enum already exists, use create_type=False)
    op.create_table(
        "billings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("status", sa.Enum('pending', 'paid', 'failed', name='billingstatus', create_type=False), nullable=False, server_default="pending"),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payment_id", sa.String(length=255), nullable=True),
        sa.Column("payment_method", sa.String(length=50), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("appointment_id", name="uq_billing_appointment"),
    )

    # Create indexes
    op.create_index("idx_billing_created_by", "billings", ["created_by"])
    op.create_index("idx_billing_paid_at", "billings", ["paid_at"])
    op.create_index("idx_billing_status_paid_at", "billings", ["status", "paid_at"])


def downgrade():
    op.drop_index("idx_billing_status_paid_at", table_name="billings")
    op.drop_index("idx_billing_paid_at", table_name="billings")
    op.drop_index("idx_billing_created_by", table_name="billings")
    op.drop_table("billings")
