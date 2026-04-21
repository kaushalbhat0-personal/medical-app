from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tenant import UserTenant
from app.models.user import User, UserRole


def get_current_tenant_id(user: User, db: Session) -> UUID | None:
    """
    Returns the effective tenant_id for the current user.

    - super_admin: None (no tenant filtering)
    - others: primary tenant_id from user_tenant (is_primary = true)
    """

    if user.role == UserRole.super_admin:
        return None

    stmt = (
        select(UserTenant.tenant_id)
        .where(
            UserTenant.user_id == user.id,
            UserTenant.is_primary == True,
        )
        .limit(1)
    )
    return db.scalar(stmt)

