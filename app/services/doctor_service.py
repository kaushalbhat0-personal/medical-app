from __future__ import annotations

import hashlib
import json
import logging
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.organization_display import organization_label_from_active_doctor_count
from app.core.security import hash_password
from app.crud import crud_doctor, crud_doctor_availability, crud_tenant, crud_user

from app.models.doctor import Doctor

from app.models.tenant import Tenant, TenantType

from app.models.user import User, UserRole

from app.core.tenant_context import get_current_tenant_id

from app.schemas.doctor import DoctorCreate, DoctorUpdate

from app.services.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError

from app.services.security_audit import (

    assert_authorized,

    log_audit_mutation,

    log_rbac_mutation_violation,

)



logger = logging.getLogger(__name__)


def _normalize_timezone_string(tz: str) -> str:
    stripped = tz.strip()
    if not stripped:
        raise ValidationError("timezone must be a non-empty IANA name")
    try:
        ZoneInfo(stripped)
    except (ZoneInfoNotFoundError, OSError):
        logger.warning("Unknown or unavailable IANA timezone %r; using UTC", stripped)
        return "UTC"
    return stripped


def hydrate_doctor_availability_flags(db: Session, doctors: list[Doctor]) -> None:
    if not doctors:
        return
    counts = crud_doctor_availability.count_availability_windows_by_doctor_ids(db, [d.id for d in doctors])
    for d in doctors:
        setattr(d, "has_availability_windows", counts.get(d.id, 0) > 0)



def _validate_experience_years(experience_years: int | None) -> None:

    if experience_years is not None and experience_years < 0:

        raise ValidationError("Experience years must be greater than or equal to 0")


def _doctor_creation_payload_hash(doctor_in: DoctorCreate) -> str:
    body = doctor_in.model_dump(mode="json")
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def create_hospital_doctor_with_login(
    db: Session,
    doctor_in: DoctorCreate,
    current_user: User,
    tenant_id: UUID,
    idempotency_key: str | None = None,
) -> Doctor:
    """
    Admin/super_admin: create User (doctor) + user_tenant + Doctor in one transaction with optional idempotency.
    """
    authorize_doctor_create(current_user)
    if db.get(Tenant, tenant_id) is None:
        raise ValidationError("Tenant not found")

    if idempotency_key is not None:
        idempotency_key = idempotency_key.strip() or None

    body_hash = _doctor_creation_payload_hash(doctor_in)
    if idempotency_key:
        existing = crud_doctor.get_doctor_idempotency_record(
            db, current_user.id, idempotency_key
        )
        if existing is not None:
            if existing.request_hash != body_hash:
                raise ConflictError(
                    "Idempotency key reused with different request payload"
                )
            doctor = get_doctor_or_404(db, existing.doctor_id)
            if doctor.user_id is not None:
                u = crud_user.get_user(db, doctor.user_id)
                setattr(doctor, "linked_user_email", u.email if u is not None else None)
            else:
                setattr(doctor, "linked_user_email", None)
            hydrate_doctor_availability_flags(db, [doctor])
            return doctor

    _validate_experience_years(doctor_in.experience_years)

    doctor_data = doctor_in.model_dump()
    account_email = doctor_data.pop("account_email", None)
    account_password = doctor_data.pop("account_password", None)
    doctor_data.pop("tenant_id", None)
    doctor_data.pop("user_id", None)
    if doctor_data.get("timezone") is None:
        doctor_data.pop("timezone", None)
    else:
        doctor_data["timezone"] = _normalize_timezone_string(doctor_data["timezone"])

    if not account_email or not str(account_email).strip() or not account_password:
        raise ValidationError(
            "account_email and account_password are required to create a doctor with a login"
        )
    pwd = str(account_password)
    if len(pwd) < 8:
        raise ValidationError("Password must be at least 8 characters")
    email_norm = str(account_email).strip().lower()

    if crud_user.get_user_by_email(db, email_norm):
        raise ValidationError("Email already registered")

    doctor_data["tenant_id"] = tenant_id

    if current_user.role != UserRole.super_admin:
        user_tenant = get_current_tenant_id(current_user, db)
        if user_tenant is None:
            raise ForbiddenError("Tenant context is required to create a doctor profile")
        assert_authorized(
            "create",
            "doctor",
            current_user,
            user_tenant,
            resource_tenant_id=tenant_id,
        )

    try:
        hashed = hash_password(pwd)
        try:
            new_user = crud_user.create_user_tx(
                db,
                {
                    "email": email_norm,
                    "hashed_password": hashed,
                    "role": UserRole.doctor,
                    "force_password_reset": True,
                },
            )
        except IntegrityError:
            raise ValidationError("Email already registered") from None

        crud_tenant.create_user_tenant_tx(
            db,
            user_id=new_user.id,
            tenant_id=tenant_id,
            role="doctor",
            is_primary=True,
        )
        doctor_data["user_id"] = new_user.id
        doctor = crud_doctor.create_doctor_tx(db, doctor_data)
        if idempotency_key:
            try:
                crud_doctor.record_doctor_idempotency(
                    db,
                    user_id=current_user.id,
                    idempotency_key=idempotency_key,
                    request_hash=body_hash,
                    doctor_id=doctor.id,
                )
            except IntegrityError as e:
                db.rollback()
                existing = crud_doctor.get_doctor_idempotency_record(
                    db, current_user.id, idempotency_key
                )
                if existing is not None and existing.request_hash == body_hash:
                    doctor2 = get_doctor_or_404(db, existing.doctor_id)
                    u = crud_user.get_user(db, doctor2.user_id) if doctor2.user_id else None
                    setattr(doctor2, "linked_user_email", u.email if u else None)
                    hydrate_doctor_availability_flags(db, [doctor2])
                    return doctor2
                msg = str(getattr(e, "orig", e))
                if "uq_doctor_idempotency_user_key" in msg or (
                    "doctor_creation_idempotency" in msg.lower()
                ):
                    existing2 = crud_doctor.get_doctor_idempotency_record(
                        db, current_user.id, idempotency_key
                    )
                    if existing2 is not None and existing2.request_hash == body_hash:
                        doctor3 = get_doctor_or_404(db, existing2.doctor_id)
                        u3 = crud_user.get_user(db, doctor3.user_id) if doctor3.user_id else None
                        setattr(doctor3, "linked_user_email", u3.email if u3 else None)
                        hydrate_doctor_availability_flags(db, [doctor3])
                        return doctor3
                raise
    except IntegrityError as e:
        db.rollback()
        msg = str(getattr(e, "orig", e))
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
        if (
            "ix_doctors_user_id" in msg
            or "uq_doctors_user_id" in msg
            or (
                "doctors" in msg.lower()
                and "user_id" in msg.lower()
                and "UNIQUE" in msg.upper()
            )
        ):
            raise ValidationError(
                "A doctor profile already exists for this user"
            ) from e
        raise

    db.refresh(doctor)
    u = crud_user.get_user(db, doctor.user_id) if doctor.user_id else None
    setattr(doctor, "linked_user_email", u.email if u else None)
    hydrate_doctor_availability_flags(db, [doctor])

    logger.info(
        "[DOCTOR CREATED] user_id=%s doctor_id=%s tenant_id=%s",
        doctor.user_id,
        doctor.id,
        doctor.tenant_id,
    )
    log_audit_mutation(
        "create",
        current_user,
        "doctor",
        doctor.id,
        doctor.tenant_id,
    )
    return doctor


def authorize_doctor_create(current_user: User) -> None:

    allowed = current_user.role in (
        UserRole.admin,
        UserRole.super_admin,
        UserRole.staff,
    ) or (current_user.role == UserRole.doctor and current_user.is_owner)
    if not allowed:
        log_rbac_mutation_violation(current_user, "doctor")
        raise ForbiddenError("Only administrators can create doctor profiles")





def authorize_doctor_read(

    db: Session,

    doctor: Doctor,

    current_user: User,

    tenant_id: UUID | None,

) -> None:

    if current_user.role == UserRole.super_admin:

        return

    if current_user.role == UserRole.patient:

        return

    if tenant_id is not None:

        assert_authorized(

            "read",

            "doctor",

            current_user,

            tenant_id,

            resource_tenant_id=doctor.tenant_id,

        )





def authorize_doctor_update(

    db: Session,

    doctor: Doctor,

    current_user: User,

    tenant_id: UUID | None,

) -> None:

    if current_user.role == UserRole.super_admin:

        return

    assert_authorized(

        "update",

        "doctor",

        current_user,

        tenant_id,

        resource_tenant_id=doctor.tenant_id,

    )

    if current_user.role in (UserRole.admin, UserRole.staff):

        return

    if current_user.role == UserRole.doctor and current_user.is_owner:

        return

    if current_user.role == UserRole.doctor and doctor.user_id == current_user.id:

        return

    log_rbac_mutation_violation(current_user, "doctor")

    raise ForbiddenError("Not allowed to update this doctor profile")





def authorize_doctor_delete(

    db: Session,

    doctor: Doctor,

    current_user: User,

    tenant_id: UUID | None,

) -> None:

    if current_user.role == UserRole.super_admin:

        return

    assert_authorized(

        "delete",

        "doctor",

        current_user,

        tenant_id,

        resource_tenant_id=doctor.tenant_id,

    )

    if doctor.user_id is not None:
        target_user = crud_user.get_user(db, doctor.user_id)
        if target_user is not None and target_user.is_owner:
            log_rbac_mutation_violation(current_user, "doctor", action="delete_owner")
            raise ForbiddenError(
                "The practice owner cannot be removed from the organization"
            )

    if current_user.role in (UserRole.admin, UserRole.staff):

        return

    if current_user.role == UserRole.doctor and current_user.is_owner:

        return

    log_rbac_mutation_violation(current_user, "doctor")

    raise ForbiddenError("Only administrators may delete doctor profiles")





def create_independent_doctor(
    db: Session,
    doctor_in: DoctorCreate,
    user_id: UUID,
    *,
    current_user: User | None = None,
) -> Doctor:
    """
    Doctor self-signup: create a single-tenant org (clinic) and a doctor row linked to the user.
    The tenant is named "{name} Clinic"; type is always ``clinic`` (same model as multi-doctor clinics).
    """
    if current_user is not None:
        authorize_doctor_create(current_user)

    _validate_experience_years(doctor_in.experience_years)
    doctor_data = doctor_in.model_dump()
    doctor_data.pop("account_email", None)
    doctor_data.pop("account_password", None)
    doctor_data.pop("tenant_id", None)
    doctor_data.pop("user_id", None)
    if doctor_data.get("timezone") is None:
        doctor_data.pop("timezone", None)
    else:
        doctor_data["timezone"] = _normalize_timezone_string(doctor_data["timezone"])

    tenant = crud_tenant.create_tenant_tx(
        db,
        name=f"{doctor_in.name} Clinic",
        type=TenantType.clinic,
        is_active=True,
    )
    crud_tenant.create_user_tenant_tx(
        db,
        user_id=user_id,
        tenant_id=tenant.id,
        role="doctor",
        is_primary=True,
    )
    u = crud_user.get_user(db, user_id)
    if u is not None:
        u.is_owner = True
    doctor_data["tenant_id"] = tenant.id
    doctor_data["user_id"] = user_id
    doctor = crud_doctor.create_doctor_tx(db, doctor_data)
    logger.info(
        "[DOCTOR CREATED] user_id=%s doctor_id=%s tenant_id=%s (independent clinic tenant)",
        user_id,
        doctor.id,
        doctor.tenant_id,
    )
    if current_user is not None:
        log_audit_mutation(
            "create",
            current_user,
            "doctor",
            doctor.id,
            doctor.tenant_id,
        )
    return doctor


def create_doctor(

    db: Session,

    doctor_in: DoctorCreate,

    tenant_id: UUID | None = None,

    user_id: UUID | None = None,

    current_user: User | None = None,

    idempotency_key: str | None = None,

) -> Doctor:

    if current_user is not None:

        authorize_doctor_create(current_user)



    if tenant_id is None and user_id is not None:

        return create_independent_doctor(db, doctor_in, user_id, current_user=current_user)

    _validate_experience_years(doctor_in.experience_years)

    doctor_data = doctor_in.model_dump()
    account_email = doctor_data.pop("account_email", None)
    account_password = doctor_data.pop("account_password", None)
    doctor_data.pop("tenant_id", None)
    doctor_data.pop("user_id", None)
    if doctor_data.get("timezone") is None:
        doctor_data.pop("timezone", None)
    else:
        doctor_data["timezone"] = _normalize_timezone_string(doctor_data["timezone"])



    if tenant_id is None:

        logger.error("[TENANT INTEGRITY] doctor.tenant_id is None during create (user_id=%s)", user_id)

        raise ValidationError("Doctor tenant_id is required")

    doctor_data["tenant_id"] = tenant_id

    resolved_user_id = user_id
    _admin_like = current_user is not None and (
        current_user.role in (UserRole.admin, UserRole.super_admin, UserRole.staff)
        or (current_user.role == UserRole.doctor and current_user.is_owner)
    )
    if (
        resolved_user_id is None
        and tenant_id is not None
        and current_user is not None
        and _admin_like
        and account_email
        and str(account_email).strip()
        and account_password
    ):
        return create_hospital_doctor_with_login(
            db, doctor_in, current_user, tenant_id, idempotency_key=idempotency_key
        )

    if resolved_user_id is None and current_user is not None and _admin_like:
        raise ValidationError(
            "account_email and account_password are required to create a doctor with a login"
        )

    if resolved_user_id is not None:
        doctor_data["user_id"] = resolved_user_id

    doctor = crud_doctor.create_doctor_tx(db, doctor_data)

    if doctor.user_id is None:
        logger.warning(
            "[DOCTOR ACCOUNT] Doctor created without user_id (doctor_id=%s tenant_id=%s)",
            doctor.id,
            doctor.tenant_id,
        )

    logger.info(
        "[DOCTOR CREATED] user_id=%s doctor_id=%s tenant_id=%s",
        doctor.user_id if doctor.user_id is not None else "-",
        doctor.id,
        doctor.tenant_id,
    )

    if current_user is not None:

        if current_user.role != UserRole.super_admin:

            user_tenant = get_current_tenant_id(current_user, db)
            if user_tenant is None:
                raise ForbiddenError("Tenant context is required to create a doctor profile")
            assert_authorized(
                "create",
                "doctor",
                current_user,
                user_tenant,
                resource_tenant_id=doctor.tenant_id,
            )

        log_audit_mutation(

            "create",

            current_user,

            "doctor",

            doctor.id,

            doctor.tenant_id,

        )

    return doctor





def get_doctor_or_404(db: Session, doctor_id: UUID) -> Doctor:

    doctor = crud_doctor.get_doctor(db, doctor_id)

    if doctor is None:

        raise NotFoundError("Doctor not found")

    return doctor


def promote_doctor_to_admin(
    db: Session,
    doctor_id: UUID,
    tenant_id: UUID,
) -> User:
    """
    Single org admin per tenant: demote any existing ``users`` row with
    ``tenant_id`` + role *admin* to *doctor*, then set the selected doctor's
    linked user to *admin* with ``is_owner = True`` (same ``users.id``; no new row).
    The linked :class:`~app.models.doctor.Doctor` row is **not** removed — API/JWT
    ``roles`` from :func:`~app.services.user_roles_service.compute_roles_for_user`
    remain ``["admin", "doctor"]`` (order may vary), not ``["admin"]`` alone.
    Caller must have already authorized admin/owner (or super_admin) for ``tenant_id``.
    """
    doctor = get_doctor_or_404(db, doctor_id)
    if doctor.tenant_id is None or doctor.tenant_id != tenant_id:
        raise NotFoundError("Doctor not found in this organization")
    if doctor.user_id is None:
        raise ValidationError("This doctor has no linked login account")
    target = crud_user.get_user(db, doctor.user_id)
    if target is None:
        raise NotFoundError("User not found")
    if target.role == UserRole.super_admin:
        raise ForbiddenError("Cannot change super administrator role")
    if target.role == UserRole.patient:
        raise ValidationError("This account type cannot be promoted here")

    crud_tenant.demote_tenant_admins_to_doctors(db, tenant_id)

    if target.role != UserRole.doctor:
        raise ValidationError(
            "Only a doctor in this organization can be promoted with this action"
        )

    target.role = UserRole.admin
    target.is_owner = True
    if target.tenant_id != tenant_id:
        target.tenant_id = tenant_id
    ut = crud_tenant.get_user_tenant_row(
        db, user_id=target.id, tenant_id=tenant_id
    )
    if ut is not None:
        ut.role = "admin"
    else:
        crud_tenant.create_user_tenant_tx(
            db,
            user_id=target.id,
            tenant_id=tenant_id,
            role=UserRole.admin.value,
            is_primary=True,
        )
    db.add(target)
    db.flush()
    db.refresh(target)
    return target


def get_doctor_or_404_with_tenant(db: Session, doctor_id: UUID) -> Doctor:
    """Doctor row with `tenant` loaded for RBAC and tenant scoping."""
    stmt = (
        select(Doctor)
        .where(Doctor.id == doctor_id, Doctor.is_deleted == False)
        .options(joinedload(Doctor.tenant))
    )
    doctor = db.scalars(stmt).first()
    if doctor is None:
        raise NotFoundError("Doctor not found")
    return doctor


def require_doctor_profile(db: Session, current_user: User) -> Doctor:
    """Doctor row for this user with tenant loaded; RBAC-style denials."""
    doctor = crud_doctor.get_doctor_by_user_id(db, current_user.id)
    if doctor is None:
        raise ForbiddenError("Doctor profile not found for this user")
    if doctor.tenant is None:
        raise ForbiddenError("Doctor tenant is not set")
    return doctor


def get_acting_doctor_or_none(db: Session, current_user: User) -> Doctor | None:
    """Single doctor-profile lookup per request for doctor-role users; avoids repeated joins elsewhere."""
    if current_user.role != UserRole.doctor:
        return None
    return require_doctor_profile(db, current_user)


def get_doctor_by_user_id(db: Session, user_id: UUID) -> Doctor:
    """Resolve the doctor row by doctors.user_id only (no legacy id == user.id fallback)."""
    doctor = crud_doctor.get_doctor_by_user_id(db, user_id)

    if doctor is None:

        raise ForbiddenError("Doctor profile not found for this user")

    return doctor


def get_doctors(

    db: Session,

    current_user: User | None,

    skip: int = 0,

    limit: int = 10,

    search: str | None = None,

    tenant_id: UUID | None = None,

) -> list[Doctor]:

    if current_user is None:

        logger.info("[RBAC] role=None, user=None")

    else:

        logger.info(f"[RBAC] role={current_user.role}, user={current_user.id}")

    user_id_filter: UUID | None = None

    eff_tenant_id = tenant_id



    if current_user is not None and current_user.role == UserRole.doctor:
        self_doctor = crud_doctor.get_doctor_by_user_id(db, current_user.id)
        if self_doctor is None:
            logger.warning(
                "[RBAC] doctor user has no doctor profile user_id=%s; returning empty doctor list",
                current_user.id,
            )
            return []

        eff_tenant_id = self_doctor.tenant_id
        user_id_filter = None

    elif current_user is not None and current_user.role == UserRole.patient:

        eff_tenant_id = None

    doctors = crud_doctor.get_doctors(

        db,

        skip=skip,

        limit=limit,

        search=search,

        tenant_id=eff_tenant_id,

        user_id=user_id_filter,

    )

    hydrate_doctor_availability_flags(db, doctors)

    tenant_ids = {d.tenant_id for d in doctors if d.tenant_id is not None}
    org_counts = (
        crud_doctor.count_active_doctors_by_tenant_ids(db, list(tenant_ids)) if tenant_ids else {}
    )

    for d in doctors:

        tenant = getattr(d, "tenant", None)

        if tenant is not None:

            setattr(d, "tenant_name", tenant.name)

            setattr(d, "tenant_type", tenant.type)
            n = org_counts.get(d.tenant_id, 0) if d.tenant_id is not None else 0
            setattr(d, "tenant_organization_label", organization_label_from_active_doctor_count(n))

        u = getattr(d, "user", None)
        setattr(d, "linked_user_email", u.email if u is not None else None)
        setattr(
            d,
            "linked_user_role",
            (u.role.value if u is not None and u.role is not None else None),
        )

    return doctors





def update_doctor(

    db: Session,

    doctor_id: UUID,

    doctor_in: DoctorUpdate,

    current_user: User,

    tenant_id: UUID | None,

) -> Doctor:

    _validate_experience_years(doctor_in.experience_years)

    doctor = get_doctor_or_404(db, doctor_id)

    authorize_doctor_update(db, doctor, current_user, tenant_id)

    update_data = doctor_in.model_dump(exclude_unset=True)

    if not update_data:

        return doctor

    if "timezone" in update_data and update_data["timezone"] is not None:
        update_data["timezone"] = _normalize_timezone_string(update_data["timezone"])

    if "tenant_id" in update_data and update_data["tenant_id"] is None:

        logger.error("[TENANT INTEGRITY] attempted to clear doctor.tenant_id (doctor_id=%s)", doctor_id)

        raise ValidationError("Doctor tenant_id is required")

    if "tenant_id" in update_data and tenant_id is not None:

        assert_authorized(

            "update",

            "doctor",

            current_user,

            tenant_id,

            resource_tenant_id=update_data["tenant_id"],

        )

    updated = crud_doctor.update_doctor(db, doctor, update_data)

    log_audit_mutation(

        "update",

        current_user,

        "doctor",

        updated.id,

        updated.tenant_id,

    )

    hydrate_doctor_availability_flags(db, [updated])

    return updated





def delete_doctor(

    db: Session,

    doctor_id: UUID,

    current_user: User,

    tenant_id: UUID | None,

) -> None:

    doctor = get_doctor_or_404(db, doctor_id)

    authorize_doctor_delete(db, doctor, current_user, tenant_id)

    log_audit_mutation(

        "delete",

        current_user,

        "doctor",

        doctor.id,

        doctor.tenant_id,

    )

    crud_doctor.delete_doctor(db, doctor)


