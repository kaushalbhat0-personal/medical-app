from __future__ import annotations

import hashlib
import json
import logging
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.crud import crud_tenant, crud_user
from app.models.tenant import Tenant, TenantType
from app.models.user import User, UserRole
from app.schemas.tenant import TenantCreate
from app.services.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.services.security_audit import log_audit_mutation

logger = logging.getLogger(__name__)

_ALLOWED_ORG_TYPES = frozenset({TenantType.hospital, TenantType.clinic})


def _tenant_payload_hash(tenant_in: TenantCreate) -> str:
    body = tenant_in.model_dump(mode="json")
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _resolve_idempotency(
    db: Session,
    *,
    current_user: User,
    idempotency_key: str | None,
    body_hash: str,
) -> tuple[Tenant, str | None] | None:
    if not idempotency_key:
        return None
    existing = crud_tenant.get_tenant_idempotency_record(
        db, current_user.id, idempotency_key
    )
    if existing is None:
        return None
    if existing.request_hash != body_hash:
        raise ConflictError("Idempotency key reused with different request payload")
    tenant = db.get(Tenant, existing.tenant_id)
    if tenant is None:
        raise NotFoundError("Tenant not found")
    email = crud_tenant.get_primary_admin_email_for_tenant(db, tenant.id)
    return tenant, email


def _opt_strip(s: str | None) -> str | None:
    if s is None:
        return None
    t = s.strip()
    return t if t else None


def create_tenant_minimal(
    db: Session,
    tenant_in: TenantCreate,
    current_user: User,
    idempotency_key: str | None = None,
) -> tuple[Tenant, None]:
    if tenant_in.admin is not None:
        raise ValidationError("Admin credentials are not used for organization-only creation")
    if tenant_in.type not in _ALLOWED_ORG_TYPES:
        raise ValidationError("Type must be hospital or clinic")

    if idempotency_key is not None:
        idempotency_key = idempotency_key.strip() or None

    body_hash = _tenant_payload_hash(tenant_in)
    cached = _resolve_idempotency(
        db,
        current_user=current_user,
        idempotency_key=idempotency_key,
        body_hash=body_hash,
    )
    if cached is not None:
        tenant, _email = cached
        return tenant, None

    name_stripped = tenant_in.name.strip()
    address = _opt_strip(tenant_in.address)
    phone = _opt_strip(tenant_in.phone)
    slug_stripped: str | None = None
    if tenant_in.slug is not None:
        s = tenant_in.slug.strip()
        if s:
            slug_stripped = s.lower()

    if crud_tenant.get_by_name(db, name_stripped):
        raise ValidationError("Tenant with this name already exists")
    if slug_stripped and crud_tenant.get_by_slug(db, slug_stripped):
        raise ValidationError("Tenant with this slug already exists")

    try:
        tenant = crud_tenant.create_tenant_tx(
            db,
            name=name_stripped,
            type=tenant_in.type,
            is_active=True,
            address=address,
            phone=phone,
            slug=slug_stripped,
        )
        if idempotency_key:
            crud_tenant.record_tenant_idempotency(
                db,
                user_id=current_user.id,
                idempotency_key=idempotency_key,
                request_hash=body_hash,
                tenant_id=tenant.id,
            )
        db.commit()
    except IntegrityError as e:
        db.rollback()
        if idempotency_key:
            cached2 = _resolve_idempotency(
                db,
                current_user=current_user,
                idempotency_key=idempotency_key,
                body_hash=body_hash,
            )
            if cached2 is not None:
                t2, _ = cached2
                return t2, None
        msg = str(getattr(e, "orig", e))
        if "ux_tenants_name_lower" in msg or (
            "UNIQUE" in msg.upper() and "tenant" in msg.lower() and "name" in msg.lower()
        ):
            raise ValidationError("Tenant with this name already exists") from e
        if "ux_tenants_slug" in msg or (
            "UNIQUE" in msg.upper() and "tenant" in msg.lower() and "slug" in msg.lower()
        ):
            raise ValidationError("Tenant with this slug already exists") from e
        raise

    log_audit_mutation("create", current_user, "tenant", tenant.id, tenant.id)
    logger.info("[TENANT CREATED] tenant_id=%s (org-only)", tenant.id)
    db.refresh(tenant)
    return tenant, None


def create_tenant_with_admin(
    db: Session,
    tenant_in: TenantCreate,
    current_user: User,
    idempotency_key: str | None = None,
) -> tuple[Tenant, str]:
    if tenant_in.admin is None:
        raise ValidationError("Admin credentials are required for this creation mode")
    if tenant_in.type not in _ALLOWED_ORG_TYPES:
        raise ValidationError("Type must be hospital or clinic")

    if idempotency_key is not None:
        idempotency_key = idempotency_key.strip() or None

    body_hash = _tenant_payload_hash(tenant_in)
    cached = _resolve_idempotency(
        db,
        current_user=current_user,
        idempotency_key=idempotency_key,
        body_hash=body_hash,
    )
    if cached is not None:
        tenant, email = cached
        if email is None:
            raise NotFoundError("Tenant admin not found")
        return tenant, email

    address = _opt_strip(tenant_in.address)
    phone = _opt_strip(tenant_in.phone)
    admin_creds = tenant_in.admin
    admin_user_id: UUID
    name_stripped = tenant_in.name.strip()
    slug_stripped: str | None = None
    if tenant_in.slug is not None:
        s = tenant_in.slug.strip()
        if s:
            slug_stripped = s.lower()

    if crud_tenant.get_by_name(db, name_stripped):
        raise ValidationError("Tenant with this name already exists")
    if slug_stripped and crud_tenant.get_by_slug(db, slug_stripped):
        raise ValidationError("Tenant with this slug already exists")
    pwd = str(admin_creds.password)
    if len(pwd) < 8:
        raise ValidationError("Password must be at least 8 characters")
    email_norm = str(admin_creds.email).lower().strip()
    if crud_user.get_user_by_email(db, email_norm):
        raise ValidationError("Email already registered")

    try:
        tenant = crud_tenant.create_tenant_tx(
            db,
            name=name_stripped,
            type=tenant_in.type,
            is_active=True,
            address=address,
            phone=phone,
            slug=slug_stripped,
        )
        hashed = hash_password(pwd)
        try:
            admin = crud_user.create_user_tx(
                db,
                {
                    "email": email_norm,
                    "hashed_password": hashed,
                    "role": UserRole.admin,
                    "force_password_reset": True,
                    "tenant_id": tenant.id,
                },
            )
        except IntegrityError:
            raise ValidationError("Email already registered") from None
        crud_tenant.create_user_tenant_tx(
            db,
            user_id=admin.id,
            tenant_id=tenant.id,
            role="admin",
            is_primary=True,
        )
        admin_user_id = admin.id
        if idempotency_key:
            crud_tenant.record_tenant_idempotency(
                db,
                user_id=current_user.id,
                idempotency_key=idempotency_key,
                request_hash=body_hash,
                tenant_id=tenant.id,
            )
        db.commit()
    except IntegrityError as e:
        db.rollback()
        if idempotency_key:
            cached2 = _resolve_idempotency(
                db,
                current_user=current_user,
                idempotency_key=idempotency_key,
                body_hash=body_hash,
            )
            if cached2 is not None:
                tenant2, email2 = cached2
                if email2 is None:
                    raise NotFoundError("Tenant admin not found") from e
                return tenant2, email2
        msg = str(getattr(e, "orig", e))
        if idempotency_key and (
            "uq_tenant_idempotency_user_key" in msg
            or "tenant_creation_idempotency" in msg.lower()
        ):
            existing2 = crud_tenant.get_tenant_idempotency_record(
                db, current_user.id, idempotency_key
            )
            if existing2 is not None and existing2.request_hash == body_hash:
                tenant2 = db.get(Tenant, existing2.tenant_id)
                if tenant2 is None:
                    raise NotFoundError("Tenant not found") from e
                email2 = crud_tenant.get_primary_admin_email_for_tenant(db, tenant2.id)
                if email2 is None:
                    raise NotFoundError("Tenant admin not found") from e
                return tenant2, email2
        if "ux_tenants_name_lower" in msg or (
            "UNIQUE" in msg.upper() and "tenant" in msg.lower() and "name" in msg.lower()
        ):
            raise ValidationError("Tenant with this name already exists") from e
        if "ux_tenants_slug" in msg or (
            "UNIQUE" in msg.upper() and "tenant" in msg.lower() and "slug" in msg.lower()
        ):
            raise ValidationError("Tenant with this slug already exists") from e
        if any(
            k in msg
            for k in (
                "ux_users_email_lower",
                "ux_users_email_ci",
                "ix_users_email",
                "users_email",
            )
        ) or (
            "UNIQUE" in msg.upper() and "user" in msg.lower() and "email" in msg.lower()
        ):
            raise ValidationError("Email already registered") from e
        raise

    log_audit_mutation("create", current_user, "tenant", tenant.id, tenant.id)
    logger.info(
        "[TENANT CREATED] tenant_id=%s admin_user_id=%s",
        tenant.id,
        admin_user_id,
    )

    db.refresh(tenant)
    return tenant, email_norm


def create_tenant(
    db: Session,
    tenant_in: TenantCreate,
    current_user: User,
    idempotency_key: str | None = None,
) -> tuple[Tenant, str | None]:
    if current_user.role != UserRole.super_admin:
        raise ForbiddenError("Only super administrators can create tenants")
    if tenant_in.type == TenantType.independent_doctor:
        raise ValidationError(
            "Tenant type independent_doctor is deprecated; use clinic (solo practice uses the same type)"
        )
    if tenant_in.admin is None:
        tenant, _ = create_tenant_minimal(
            db, tenant_in, current_user, idempotency_key=idempotency_key
        )
        return tenant, None
    tenant, email = create_tenant_with_admin(
        db, tenant_in, current_user, idempotency_key=idempotency_key
    )
    return tenant, email
