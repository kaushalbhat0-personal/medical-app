"""Backfill patients.tenant_id from appointments, then require NOT NULL.

Revises: h3i4j5k6l7m8
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

# Well-known default tenant (see app.core.tenancy.DEFAULT_TENANT_ID)
_DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001"

revision = "i4j5k6l7m8n9"
down_revision = "h3i4j5k6l7m8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        op.execute(
            text(
                """
                UPDATE patients p
                SET tenant_id = sub.tenant_id
                FROM (
                    SELECT patient_id, MIN(tenant_id) AS tenant_id
                    FROM appointments
                    WHERE is_deleted = false
                      AND tenant_id IS NOT NULL
                    GROUP BY patient_id
                ) sub
                WHERE p.id = sub.patient_id
                  AND p.tenant_id IS NULL
                """
            )
        )
    else:
        # SQLite 3.33+ (UPDATE ... FROM)
        op.execute(
            text(
                """
                UPDATE patients AS p
                SET tenant_id = sub.tenant_id
                FROM (
                    SELECT patient_id, MIN(tenant_id) AS tenant_id
                    FROM appointments
                    WHERE is_deleted = 0
                      AND tenant_id IS NOT NULL
                    GROUP BY patient_id
                ) AS sub
                WHERE p.id = sub.patient_id
                  AND p.tenant_id IS NULL
                """
            )
        )

    if dialect == "postgresql":
        op.execute(
            text(
                f"INSERT INTO tenants (id, name, type, is_active) VALUES "
                f"('{_DEFAULT_TENANT}', 'Default', 'hospital', true) "
                f"ON CONFLICT (id) DO NOTHING"
            )
        )
    op.execute(
        text(
            f"UPDATE patients SET tenant_id = '{_DEFAULT_TENANT}' "
            f"WHERE tenant_id IS NULL"
        )
    )

    if dialect == "postgresql":
        conn = bind
        insp = sa.inspect(conn)
        fk_name = None
        for fk in insp.get_foreign_keys("patients"):
            cols = fk.get("constrained_columns") or []
            if "tenant_id" in cols:
                fk_name = fk.get("name")
                break
        if fk_name:
            op.drop_constraint(fk_name, "patients", type_="foreignkey")
        op.alter_column(
            "patients",
            "tenant_id",
            existing_type=postgresql.UUID(as_uuid=True),
            nullable=False,
        )
        op.create_foreign_key(
            "patients_tenant_id_fkey",
            "patients",
            "tenants",
            ["tenant_id"],
            ["id"],
            ondelete="RESTRICT",
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.drop_constraint("patients_tenant_id_fkey", "patients", type_="foreignkey")
    op.alter_column(
        "patients",
        "tenant_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )
    op.create_foreign_key(
        "patients_tenant_id_fkey",
        "patients",
        "tenants",
        ["tenant_id"],
        ["id"],
        ondelete="SET NULL",
    )
