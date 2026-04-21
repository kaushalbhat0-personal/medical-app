from __future__ import annotations



import logging

from uuid import UUID



from sqlalchemy.orm import Session



from app.crud import crud_doctor, crud_tenant

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
    doctor_data.pop("tenant_id", None)
    doctor_data.pop("user_id", None)

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

    if user_id is not None:

        doctor_data["user_id"] = user_id

    doctor = crud_doctor.create_doctor_tx(db, doctor_data)

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

        user_id_filter = current_user.id

        eff_tenant_id = None

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

    for d in doctors:

        tenant = getattr(d, "tenant", None)

        if tenant is not None:

            setattr(d, "tenant_name", tenant.name)

            setattr(d, "tenant_type", tenant.type)

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


