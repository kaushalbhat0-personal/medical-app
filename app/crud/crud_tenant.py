from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tenant import Tenant, TenantType, UserTenant


def create_tenant_tx(
    db: Session,
    *,
    name: str,
    type: TenantType | str = TenantType.hospital,
    is_active: bool = True,
) -> Tenant:
    tenant = Tenant(name=name, type=str(type), is_active=is_active)
    db.add(tenant)
    db.flush()
    db.refresh(tenant)
    return tenant


def list_tenants(
    db: Session,
    *,
    type: str | None = None,
    is_active: bool | None = True,
    skip: int = 0,
    limit: int = 100,
) -> list[Tenant]:
    stmt = select(Tenant).order_by(Tenant.created_at.desc())
    if type is not None:
        stmt = stmt.where(Tenant.type == type)
    if is_active is not None:
        stmt = stmt.where(Tenant.is_active == is_active)
    stmt = stmt.offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def create_user_tenant_tx(
    db: Session,
    *,
    user_id: UUID,
    tenant_id: UUID,
    role: str = "admin",
    is_primary: bool = True,
) -> UserTenant:
    ut = UserTenant(user_id=user_id, tenant_id=tenant_id, role=role, is_primary=is_primary)
    db.add(ut)
    db.flush()
    db.refresh(ut)
    return ut

