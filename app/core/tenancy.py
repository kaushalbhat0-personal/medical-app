import uuid

from sqlalchemy import text

from app.core.database import engine
from app.models.tenant import TenantType
from app.utils.db_uuids import as_db_uuid

DEFAULT_TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
DEFAULT_TENANT_NAME = "Default"


def ensure_default_tenant_exists() -> None:
    """
    Idempotent: guarantees the well-known default tenant row exists.

    We keep a fixed UUID as a "sentinel" tenant so foreign keys (e.g. user↔tenant association)
    always have at least one valid tenant to reference in fresh databases.

    Implementation notes:
    - Uses a direct INSERT ... ON CONFLICT for startup safety and to avoid importing ORM models
      (which can trigger extra side effects during application boot).
    - Runs inside a transaction so it can be safely called at startup in a process supervisor.
    """
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO tenants (id, name, type, is_active) "
                "VALUES (:id, :name, :type, true) "
                "ON CONFLICT (id) DO NOTHING"
            ),
            {
                "id": as_db_uuid(str(DEFAULT_TENANT_ID), conn),
                "name": DEFAULT_TENANT_NAME,
                "type": TenantType.hospital.value,
            },
        )
