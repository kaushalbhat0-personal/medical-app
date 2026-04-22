"""Phase 1: tenant_id for doctors/billings + expand user roles

Revision ID: m1t2n3t4e5n6
Revises: l9n7o1g3p6q5
Create Date: 2026-04-21

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from migration_helpers import pg_column_exists, pg_constraint_exists

# revision identifiers, used by Alembic.
revision: str = "m1t2n3t4e5n6"
down_revision: Union[str, None] = "l9n7o1g3p6q5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _add_enum_value_if_missing(enum_type: str, value: str) -> None:
    # Postgres: ALTER TYPE ... ADD VALUE cannot run if the value exists.
    # We gate it via pg_enum check for safe, repeatable deploys.
    op.execute(
        sa.text(
            """
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = :enum_type AND e.enumlabel = :enum_value
  ) THEN
    EXECUTE format('ALTER TYPE %I ADD VALUE %L', :enum_type, :enum_value);
  END IF;
END$$;
"""
        ).bindparams(enum_type=enum_type, enum_value=value)
    )


def upgrade() -> None:
    # Add optional tenant_id to doctors
    if not pg_column_exists("doctors", "tenant_id"):
        op.add_column(
            "doctors",
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
    if not pg_constraint_exists("fk_doctors_tenant_id_tenants", table_name="doctors"):
        op.create_foreign_key(
            "fk_doctors_tenant_id_tenants",
            source_table="doctors",
            referent_table="tenants",
            local_cols=["tenant_id"],
            remote_cols=["id"],
            ondelete="SET NULL",
        )

    # Add optional tenant_id to billings
    if not pg_column_exists("billings", "tenant_id"):
        op.add_column(
            "billings",
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
    if not pg_constraint_exists("fk_billings_tenant_id_tenants", table_name="billings"):
        op.create_foreign_key(
            "fk_billings_tenant_id_tenants",
            source_table="billings",
            referent_table="tenants",
            local_cols=["tenant_id"],
            remote_cols=["id"],
            ondelete="SET NULL",
        )

    # Expand userrole enum (additive; do not remove existing values)
    _add_enum_value_if_missing("userrole", "super_admin")
    _add_enum_value_if_missing("userrole", "doctor")
    _add_enum_value_if_missing("userrole", "patient")


def downgrade() -> None:
    # NOTE: Postgres enums cannot safely remove values in-place.
    # We only drop the newly added columns/constraints.
    if pg_constraint_exists("fk_billings_tenant_id_tenants", table_name="billings"):
        op.drop_constraint("fk_billings_tenant_id_tenants", "billings", type_="foreignkey")
    if pg_column_exists("billings", "tenant_id"):
        op.drop_column("billings", "tenant_id")

    if pg_constraint_exists("fk_doctors_tenant_id_tenants", table_name="doctors"):
        op.drop_constraint("fk_doctors_tenant_id_tenants", "doctors", type_="foreignkey")
    if pg_column_exists("doctors", "tenant_id"):
        op.drop_column("doctors", "tenant_id")

