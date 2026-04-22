from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.crud import crud_tenant, crud_user
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.schemas.user import OrganizationUserCreate
from app.services.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError


def provision_organization_user(
    db: Session,
    actor: User,
    payload: OrganizationUserCreate,
) -> User:
    if actor.role != UserRole.super_admin:
        raise ForbiddenError("Only super administrators can provision organization users")

    email_norm = payload.email.lower().strip()
    if crud_user.get_user_by_email(db, email_norm):
        raise ConflictError("Email already registered")

    tenant = db.get(Tenant, payload.tenant_id)
    if tenant is None:
        raise NotFoundError("Tenant not found")
    if not tenant.is_active:
        raise ValidationError("Tenant is not active")

    hashed = hash_password(payload.password)
    user = crud_user.create_user_tx(
        db,
        {
            "email": email_norm,
            "hashed_password": hashed,
            "role": payload.role,
            "tenant_id": payload.tenant_id,
        },
    )
    crud_tenant.create_user_tenant_tx(
        db,
        user_id=user.id,
        tenant_id=payload.tenant_id,
        role=payload.role.value,
        is_primary=True,
    )
    return user
