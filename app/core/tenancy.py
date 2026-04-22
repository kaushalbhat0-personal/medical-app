import uuid

from sqlalchemy import text

from app.core.database import engine
from app.models.tenant import TenantType

DEFAULT_TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
DEFAULT_TENANT_NAME = "Default"


def ensure_default_tenant_exists() -> None:
    """Idempotent: guarantees the well-known default tenant row for FKs (e.g. user_tenant)."""
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO tenants (id, name, type, is_active) "
                "VALUES (:id, :name, :type, true) "
                "ON CONFLICT (id) DO NOTHING"
            ),
            {
                "id": DEFAULT_TENANT_ID,
                "name": DEFAULT_TENANT_NAME,
                "type": TenantType.hospital.value,
            },
        )
