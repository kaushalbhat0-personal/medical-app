from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.api.http_exceptions import (
    inactive_user_exception,
    unauthorized_credentials_exception,
)
from app.core.data_scope import ResolvedDataScope, resolve_data_scope
from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.tenant_context import MISSING_X_TENANT_ID_MSG, resolve_tenant_id_for_scoped_request
from app.crud import crud_doctor, crud_user
from app.models.doctor import Doctor
from app.models.user import User
from app.services import doctor_service
from app.services.exceptions import ForbiddenError, ValidationError
from app.core.permissions import require_admin_or_owner

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/login")
oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl="/api/v1/login",
    auto_error=False,
)


@dataclass
class TokenPayload:
    user_id: UUID
    role: str
    tenant_id: UUID | None


@dataclass(frozen=True)
class CurrentTenantContext:
    """Resolved RBAC tenant scope for the authenticated principal (see ``resolve_tenant_id_for_scoped_request``)."""

    user: User
    tenant_id: UUID | None


def _parse_access_token(token: str) -> TokenPayload:
    payload = decode_access_token(token)
    if payload is None:
        raise unauthorized_credentials_exception()
    if payload.get("type") != "access":
        raise unauthorized_credentials_exception()
    sub = payload.get("sub")
    if sub is None or not isinstance(sub, str):
        raise unauthorized_credentials_exception()
    try:
        user_id = UUID(sub)
    except ValueError:
        raise unauthorized_credentials_exception()

    # Backward-compatible: legacy tokens may not contain role/tenant_id
    role = payload.get("role")
    if not role or not isinstance(role, str):
        role = "admin"

    tenant_id = payload.get("tenant_id")
    if tenant_id and isinstance(tenant_id, str):
        try:
            tenant_id = UUID(tenant_id)
        except ValueError:
            tenant_id = None
    else:
        tenant_id = None

    return TokenPayload(user_id=user_id, role=role, tenant_id=tenant_id)


def _user_id_from_access_token(token: str) -> UUID:
    # Kept for backward compatibility with existing code
    return _parse_access_token(token).user_id


def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> User | None:
    if not token:
        return None
    user_id = _user_id_from_access_token(token)
    user = crud_user.get_user(db, user_id)
    if user is None or not user.is_active:
        return None
    return user


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    user_id = _user_id_from_access_token(token)
    user = crud_user.get_user(db, user_id)
    if user is None:
        raise unauthorized_credentials_exception()
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise inactive_user_exception()
    return current_user


def get_current_auth_context(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> TokenPayload:
    auth_ctx = _parse_access_token(token)
    user = crud_user.get_user(db, auth_ctx.user_id)
    if user is None:
        raise unauthorized_credentials_exception()
    if not user.is_active:
        raise inactive_user_exception()
    return auth_ctx


def get_acting_doctor_optional(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Doctor | None:
    """At most one doctor-profile load per request (doctor-role users only)."""
    return doctor_service.get_acting_doctor_or_none(db, current_user)


def get_acting_doctor_optional_active(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Doctor | None:
    """Same as ``get_acting_doctor_optional`` but for routes that require an active user."""
    return doctor_service.get_acting_doctor_or_none(db, current_user)


def get_linked_doctor_profile_optional(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Doctor | None:
    """Doctor row linked to this login (any role), for X-Data-Scope resolution."""
    return crud_doctor.get_doctor_by_user_id(db, current_user.id)


def get_resolved_data_scope(
    x_data_scope: str | None = Header(default=None, alias="X-Data-Scope"),
    current_user: User = Depends(get_current_user),
    linked_doctor: Doctor | None = Depends(get_linked_doctor_profile_optional),
) -> ResolvedDataScope:
    return resolve_data_scope(
        x_data_scope, current_user=current_user, linked_doctor=linked_doctor
    )


def get_current_doctor(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Doctor:
    """Doctor profile for the current user; use on doctor-only routes."""
    return doctor_service.require_doctor_profile(db, current_user)


def get_optional_scoped_tenant_id(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_tenant_id: UUID | None = Header(default=None, alias="X-Tenant-ID"),
) -> UUID | None:
    """Tenant scope for routes that patients may call with ``tenant_id=None`` (e.g. slot reads)."""
    return resolve_tenant_id_for_scoped_request(db, current_user, x_tenant_id)


def get_optional_scoped_tenant_id_active(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    x_tenant_id: UUID | None = Header(default=None, alias="X-Tenant-ID"),
) -> UUID | None:
    """Like ``get_optional_scoped_tenant_id`` but requires an active user (mutations)."""
    return resolve_tenant_id_for_scoped_request(db, current_user, x_tenant_id)


def get_scoped_tenant_id(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_tenant_id: UUID | None = Header(default=None, alias="X-Tenant-ID"),
) -> UUID:
    tid = resolve_tenant_id_for_scoped_request(db, current_user, x_tenant_id)
    if tid is None:
        raise ValidationError(MISSING_X_TENANT_ID_MSG)
    return tid


def get_scoped_tenant_id_active(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    x_tenant_id: UUID | None = Header(default=None, alias="X-Tenant-ID"),
) -> UUID:
    tid = resolve_tenant_id_for_scoped_request(db, current_user, x_tenant_id)
    if tid is None:
        raise ValidationError(MISSING_X_TENANT_ID_MSG)
    return tid


def get_current_tenant_context(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_tenant_id: UUID | None = Header(default=None, alias="X-Tenant-ID"),
) -> CurrentTenantContext:
    tenant_id = resolve_tenant_id_for_scoped_request(db, current_user, x_tenant_id)
    return CurrentTenantContext(user=current_user, tenant_id=tenant_id)


def get_current_tenant_context_active(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    x_tenant_id: UUID | None = Header(default=None, alias="X-Tenant-ID"),
) -> CurrentTenantContext:
    tenant_id = resolve_tenant_id_for_scoped_request(db, current_user, x_tenant_id)
    return CurrentTenantContext(user=current_user, tenant_id=tenant_id)


def require_current_user_admin_or_owner(
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_scoped_tenant_id_active),
    current_user: User = Depends(get_current_active_user),
) -> User:
    """FastAPI guard: org admin, staff, super_admin, or practice owner in ``tenant_id``."""
    try:
        require_admin_or_owner(db, current_user, tenant_id)
    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=str(e)
        ) from e
    return current_user
