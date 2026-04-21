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
    - others: primary tenant_id from user_tenant (is_primary = true), with fallbacks
      when no primary row exists (legacy or misconfigured memberships).
    """

    if user.role == UserRole.super_admin:
        return None

    stmt_primary = (
        select(UserTenant.tenant_id)
        .where(
            UserTenant.user_id == user.id,
            UserTenant.is_primary == True,
        )
        .limit(1)
    )
    tenant_id = db.scalar(stmt_primary)
    if tenant_id is not None:
        return tenant_id

    if user.role == UserRole.doctor:
        stmt_doctor = (
            select(UserTenant.tenant_id)
            .where(
                UserTenant.user_id == user.id,
                UserTenant.role == "doctor",
            )
            .order_by(UserTenant.created_at.asc())
            .limit(1)
        )
        tenant_id = db.scalar(stmt_doctor)
        if tenant_id is not None:
            return tenant_id

    stmt_any = (
        select(UserTenant.tenant_id)
        .where(UserTenant.user_id == user.id)
        .order_by(UserTenant.created_at.asc())
        .limit(1)
    )
    return db.scalar(stmt_any)

