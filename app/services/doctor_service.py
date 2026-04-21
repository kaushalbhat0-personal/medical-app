from __future__ import annotations

import logging
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.crud import crud_doctor, crud_doctor_availability, crud_tenant, crud_user

from app.models.doctor import Doctor

from app.models.tenant import TenantType

from app.models.user import User, UserRole

from app.schemas.doctor import DoctorCreate, DoctorUpdate

from app.services.exceptions import ForbiddenError, NotFoundError, ValidationError

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
    except ZoneInfoNotFoundError as e:
        raise ValidationError(f"Unknown IANA timezone: {stripped!r}") from e
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





def authorize_doctor_create(current_user: User) -> None:

    if current_user.role == UserRole.doctor:

        log_rbac_mutation_violation(current_user, "doctor")

        raise ForbiddenError("Doctors cannot create doctor profiles")

    if current_user.role not in (UserRole.admin, UserRole.super_admin):

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

    if current_user.role in (UserRole.admin, UserRole.staff):

        return

    log_rbac_mutation_violation(current_user, "doctor")

    raise ForbiddenError("Only administrators may delete doctor profiles")





def create_doctor(

    db: Session,

    doctor_in: DoctorCreate,

    tenant_id: UUID | None = None,

    user_id: UUID | None = None,

    current_user: User | None = None,

) -> Doctor:

    if current_user is not None:

        authorize_doctor_create(current_user)



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

    if tenant_id is None and user_id is not None:

        tenant = crud_tenant.create_tenant_tx(

            db,

            name=f"Dr. {doctor_in.name}",

            type=TenantType.independent_doctor,

            is_active=True,

        )

        crud_tenant.create_user_tenant_tx(

            db,

            user_id=user_id,

            tenant_id=tenant.id,

            role="doctor",

            is_primary=True,

        )

        doctor_data["tenant_id"] = tenant.id

        doctor_data["user_id"] = user_id

        doctor = crud_doctor.create_doctor_tx(db, doctor_data)

        logger.info(
            "[DOCTOR CREATED] user_id=%s doctor_id=%s tenant_id=%s",
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



    if tenant_id is None:

        logger.error("[TENANT INTEGRITY] doctor.tenant_id is None during create (user_id=%s)", user_id)

        raise ValidationError("Doctor tenant_id is required")

    doctor_data["tenant_id"] = tenant_id

    resolved_user_id = user_id
    if (
        resolved_user_id is None
        and tenant_id is not None
        and current_user is not None
        and current_user.role in (UserRole.admin, UserRole.super_admin)
    ):
        if not account_email or not str(account_email).strip() or not account_password:
            raise ValidationError(
                "account_email and account_password are required to create a doctor with a login"
            )
        pwd = str(account_password)
        if len(pwd) < 8:
            raise ValidationError("account_password must be at least 8 characters")
        email_normalized = str(account_email).lower().strip()
        if crud_user.get_user_by_email(db, email_normalized):
            raise ValidationError("Email already registered")
        hashed = hash_password(pwd)
        new_user = crud_user.create_user_tx(
            db,
            {
                "email": email_normalized,
                "hashed_password": hashed,
                "role": UserRole.doctor,
                "force_password_reset": True,
            },
        )
        crud_tenant.create_user_tenant_tx(
            db,
            user_id=new_user.id,
            tenant_id=tenant_id,
            role="doctor",
            is_primary=True,
        )
        resolved_user_id = new_user.id
        logger.info(
            "[DOCTOR ACCOUNT] user_id=%s force_password_reset=true; change password on first login",
            new_user.id,
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

            assert_authorized(

                "create",

                "doctor",

                current_user,

                tenant_id,

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





def get_doctor_by_user_id(db: Session, user_id: UUID) -> Doctor:
    """Resolve the doctor row by doctors.user_id only (no legacy id == user.id fallback)."""
    doctor = crud_doctor.get_doctor_by_user_id(db, user_id)

    if doctor is None:

        raise NotFoundError("Doctor profile not found for this user")

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
        try:
            self_doctor = get_doctor_by_user_id(db, current_user.id)
        except NotFoundError:
            logger.warning(
                "[RBAC] doctor user has no doctor profile user_id=%s; returning empty doctor list",
                current_user.id,
            )
            return []

        eff_tenant_id = self_doctor.tenant_id
        user_id_filter = None

    elif current_user is not None and current_user.role == UserRole.patient:

        eff_tenant_id = None

    elif current_user is not None and current_user.role == UserRole.super_admin:

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

    for d in doctors:

        tenant = getattr(d, "tenant", None)

        if tenant is not None:

            setattr(d, "tenant_name", tenant.name)

            setattr(d, "tenant_type", tenant.type)

        u = getattr(d, "user", None)
        setattr(d, "linked_user_email", u.email if u is not None else None)

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


