"""Add multi-tenant tables

Revision ID: l9n7o1g3p6q5
Revises: k8m6n0f2o5p4
Create Date: 2026-04-21 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "l9n7o1g3p6q5"
down_revision: Union[str, None] = "k8m6n0f2o5p4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create tenants table
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False, server_default="hospital"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create user_tenant table
    op.create_table(
        "user_tenant",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False, server_default="admin"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )

    # Add optional tenant_id to appointments
    op.add_column(
        "appointments",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "idx_appointments_tenant_id",
        "appointments",
        ["tenant_id"],
        unique=False,
    )

    # Add optional tenant_id to patients
    op.add_column(
        "patients",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "idx_patients_tenant_id",
        "patients",
        ["tenant_id"],
        unique=False,
    )

    op.create_index("ix_doctors_tenant_id", "doctors", ["tenant_id"])
    op.create_index("ix_billings_tenant_id", "billings", ["tenant_id"])

    # Data migration: create default tenant for existing data
    # Uses a fixed UUID so future data-linking migrations can reference it deterministically
    op.execute(
        "INSERT INTO tenants (id, name, type) VALUES ('00000000-0000-0000-0000-000000000001', 'Default Hospital', 'hospital')"
    )

    # Data migration: ensure all existing users have a role
    op.execute("UPDATE users SET role = 'admin' WHERE role IS NULL")


def downgrade() -> None:
    op.drop_index("ix_billings_tenant_id", table_name="billings")
    op.drop_index("ix_doctors_tenant_id", table_name="doctors")

    op.drop_index("idx_patients_tenant_id", table_name="patients")
    op.drop_column("patients", "tenant_id")

    op.drop_index("idx_appointments_tenant_id", table_name="appointments")
    op.drop_column("appointments", "tenant_id")

    op.drop_table("user_tenant")
    op.drop_table("tenants")
