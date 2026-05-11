"""Add tenant organization profile and branding profile tables.

Phase 3C — Tenant Branding + Organization Profile Foundation.

Revision ID: z3_tenant_branding_profiles
Revises: z2_reporting_indexes
Create Date: 2026-05-11 08:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "z3_tenant_branding_profiles"
down_revision: Union[str, None] = "z2_reporting_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── TenantOrganizationProfile ──────────────────────────────────────────
    op.create_table(
        "tenant_organization_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("organization_name", sa.String(255), nullable=True),
        sa.Column("legal_name", sa.String(255), nullable=True),
        sa.Column("logo_url", sa.Text(), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("address_line_1", sa.String(255), nullable=True),
        sa.Column("address_line_2", sa.String(255), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("postal_code", sa.String(20), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("gst_number", sa.String(50), nullable=True),
        sa.Column("registration_number", sa.String(100), nullable=True),
        sa.Column("timezone", sa.String(50), nullable=True),
        sa.Column("currency", sa.String(10), nullable=True),
        sa.Column("prescription_footer", sa.Text(), nullable=True),
        sa.Column("invoice_footer", sa.Text(), nullable=True),
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
    )

    # ── TenantBrandingProfile ──────────────────────────────────────────────
    op.create_table(
        "tenant_branding_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("primary_color", sa.String(7), nullable=True, comment="Hex color e.g. #2563eb"),
        sa.Column("secondary_color", sa.String(7), nullable=True, comment="Hex color e.g. #64748b"),
        sa.Column("accent_color", sa.String(7), nullable=True, comment="Hex color e.g. #f59e0b"),
        sa.Column("document_header_style", sa.String(50), nullable=True, comment="e.g. default, minimal, branded"),
        sa.Column("watermark_text", sa.String(255), nullable=True),
        sa.Column("prescription_template", sa.String(100), nullable=True, comment="Template identifier for prescriptions"),
        sa.Column("invoice_template", sa.String(100), nullable=True, comment="Template identifier for invoices"),
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
    )

    # Indexes
    op.create_index(
        "ix_tenant_org_profiles_tenant_id",
        "tenant_organization_profiles",
        ["tenant_id"],
        unique=True,
    )
    op.create_index(
        "ix_tenant_branding_profiles_tenant_id",
        "tenant_branding_profiles",
        ["tenant_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("tenant_branding_profiles")
    op.drop_table("tenant_organization_profiles")
