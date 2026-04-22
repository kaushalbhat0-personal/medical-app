from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tenant import Tenant, UserTenant
from app.models.user import User, UserRole
from app.services.exceptions import ForbiddenError, ValidationError


def get_current_tenant_id(user: User, db: Session) -> UUID | None:
    """
    Canonical home tenant for the user (JWT and X-Tenant-ID validation).

    - super_admin: None (no fixed org)
    - patient: None here; patient APIs scope by user/patient row, not this helper
    - others: ``users.tenant_id`` when set, else legacy primary ``user_tenant`` row
    """

    if user.role == UserRole.super_admin:
        return None
    if user.role == UserRole.patient:
        return None
    if user.tenant_id is not None:
        return user.tenant_id

    stmt_primary = (
        select(UserTenant.tenant_id)
        .where(
            UserTenant.user_id == user.id,
            UserTenant.is_primary == True,  # noqa: E712
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


def resolve_tenant_id_for_scoped_request(
    db: Session,
    user: User,
    x_tenant_id: UUID | None,
) -> UUID | None:
    """
    Effective tenant for the request: ``X-Tenant-ID`` when provided, otherwise the user's home tenant.

    - patient: None (doctor/slot reads use separate RBAC).
    - super_admin: ``X-Tenant-ID`` required; must exist and be active (cross-tenant override).
    - admin / doctor / staff: home tenant required; optional header must match home (no spoofing).
    """
    if user.role == UserRole.patient:
        return None

    if user.role == UserRole.super_admin:
        if x_tenant_id is None:
            raise ValidationError("X-Tenant-ID header is required")
        row = db.get(Tenant, x_tenant_id)
        if row is None:
            raise ValidationError("Tenant not found")
        if not row.is_active:
            raise ValidationError("Tenant is not active")
        return x_tenant_id

    home = get_current_tenant_id(user, db)
    if home is None:
        raise ValidationError("Tenant context is not configured for this user")

    chosen = x_tenant_id if x_tenant_id is not None else home
    if chosen != home:
        raise ForbiddenError("X-Tenant-ID does not match your organization")
    return chosen
