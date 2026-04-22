import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.tenancy import DEFAULT_TENANT_ID
from app.crud import crud_patient
from app.models.doctor import Doctor
from app.services import doctor_service
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.schemas.patient import PatientCreate, PatientUpdate
from app.services.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.services.security_audit import (
    assert_authorized,
    log_audit_mutation,
    log_rbac_mutation_violation,
)

logger = logging.getLogger(__name__)


def _validate_age(age: int | None) -> None:
    if age is not None and age < 0:
        raise ValidationError("Age must be greater than or equal to 0")


def authorize_patient_create(
    db: Session,
    current_user: User,
    tenant_id: UUID | None,
    *,
    acting_doctor: Doctor | None = None,
) -> None:
    if current_user.role == UserRole.patient:
        log_rbac_mutation_violation(
            current_user, "patient", action="create_patient"
        )
        raise ForbiddenError("Cannot create another patient record")
    if current_user.role == UserRole.super_admin:
        return
    if current_user.role in (UserRole.admin, UserRole.staff):
        return
    if current_user.role == UserRole.doctor:
        try:
            doc = acting_doctor or doctor_service.require_doctor_profile(
                db, current_user
            )
        except ForbiddenError:
            log_rbac_mutation_violation(
                current_user, "patient", action="create_patient"
            )
            raise
        try:
            doctor_service.ensure_self_managed_doctor(doc)
        except ForbiddenError:
            log_rbac_mutation_violation(
                current_user,
                "patient",
                action="create_patient",
                tenant_type=doc.tenant.type if doc.tenant else None,
            )
            raise
        return
    log_rbac_mutation_violation(current_user, "patient", action="create_patient")
    raise ForbiddenError("Not allowed to create patients")


def create_patient(
    db: Session,
    patient_in: PatientCreate,
    current_user: User,
    tenant_id: UUID | None,
    *,
    acting_doctor: Doctor | None = None,
) -> Patient:
    _validate_age(patient_in.age)
    logger.info(f"[RBAC] role={current_user.role}, user={current_user.id}")
    authorize_patient_create(
        db, current_user, tenant_id, acting_doctor=acting_doctor
    )
    patient_data = patient_in.model_dump()
    patient_data.pop("created_by", None)
    patient_data["created_by"] = current_user.id
    patient_data["tenant_id"] = tenant_id or DEFAULT_TENANT_ID
    if tenant_id is not None:
        assert_authorized(
            "create",
            "patient",
            current_user,
            tenant_id,
            resource_tenant_id=patient_data["tenant_id"],
        )
    patient = crud_patient.create_patient(db, patient_data)
    log_audit_mutation(
        "create",
        current_user,
        "patient",
        patient.id,
        patient.tenant_id,
    )
    return patient


def get_patient_or_404(db: Session, patient_id: UUID) -> Patient:
    patient = crud_patient.get_patient(db, patient_id)
    if patient is None:
        raise NotFoundError("Patient not found")
    return patient


def get_patient_by_user_id(db: Session, user_id: UUID) -> Patient:
    patient = crud_patient.get_patient_by_user_id(db, user_id)
    if patient is None:
        raise NotFoundError("Patient profile not found for this user")
    return patient


def authorize_patient_access(
    db: Session,
    patient: Patient,
    current_user: User,
    tenant_id: UUID | None,
    *,
    acting_doctor: Doctor | None = None,
    rbac_action: str = "patient_access",
) -> None:
    if current_user.role == UserRole.super_admin:
        return

    if tenant_id is not None:
        if patient.tenant_id is not None:
            assert_authorized(
                "access",
                "patient",
                current_user,
                tenant_id,
                resource_tenant_id=patient.tenant_id,
            )
        else:
            if not crud_patient.patient_has_active_appointment_in_tenant(
                db, patient.id, tenant_id
            ):
                log_rbac_mutation_violation(
                    current_user, "patient", action=rbac_action
                )
                raise ForbiddenError("Patient is not in your tenant")

    if current_user.role in (UserRole.admin, UserRole.staff):
        return

    if current_user.role == UserRole.doctor:
        doc = acting_doctor or doctor_service.require_doctor_profile(
            db, current_user
        )
        if doctor_service.doctor_is_independent(doc):
            if patient.created_by == current_user.id:
                return
        if crud_patient.patient_has_appointment_with_doctor(
            db, patient.id, doc.id
        ):
            return
        log_rbac_mutation_violation(
            current_user,
            "patient",
            action=rbac_action,
            tenant_type=doc.tenant.type if doc.tenant else None,
        )
        raise ForbiddenError("Not allowed to modify this patient")

    if current_user.role == UserRole.patient:
        if patient.user_id != current_user.id:
            log_rbac_mutation_violation(
                current_user, "patient", action=rbac_action
            )
            raise ForbiddenError("Not allowed to modify this patient")
        return

    log_rbac_mutation_violation(current_user, "patient", action=rbac_action)
    raise ForbiddenError("Not allowed to modify this patient")


authorize_patient_read = authorize_patient_access
authorize_patient_update = authorize_patient_access
authorize_patient_delete = authorize_patient_access


def get_patients(
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 10,
    search: str | None = None,
    tenant_id: UUID | None = None,
    *,
    acting_doctor: Doctor | None = None,
) -> list[Patient]:
    logger.info(f"[RBAC] role={current_user.role}, user={current_user.id}")
    created_by: UUID | None = None
    user_id: UUID | None = None
    effective_tenant_id = tenant_id

    linked_doctor_id: UUID | None = None
    doctor_created_by_user_id: UUID | None = None
    if current_user.role == UserRole.doctor:
        doc = acting_doctor or doctor_service.require_doctor_profile(
            db, current_user
        )
        linked_doctor_id = doc.id
        if doctor_service.doctor_is_independent(doc):
            doctor_created_by_user_id = current_user.id
    elif current_user.role == UserRole.patient:
        user_id = current_user.id
        # Own profile is keyed by user_id; patient rows may not carry tenant_id
        effective_tenant_id = None
    elif current_user.role == UserRole.admin:
        pass  # tenant filter only (caller supplies tenant_id)
    elif current_user.role == UserRole.super_admin:
        effective_tenant_id = None

    return crud_patient.get_patients(
        db,
        skip=skip,
        limit=limit,
        search=search,
        tenant_id=effective_tenant_id,
        created_by=created_by,
        user_id=user_id,
        linked_doctor_id=linked_doctor_id,
        doctor_created_by_user_id=doctor_created_by_user_id,
    )


def update_patient(
    db: Session,
    patient_id: UUID,
    patient_in: PatientUpdate,
    current_user: User,
    tenant_id: UUID | None,
    *,
    acting_doctor: Doctor | None = None,
) -> Patient:
    _validate_age(patient_in.age)
    patient = get_patient_or_404(db, patient_id)
    authorize_patient_update(
        db,
        patient,
        current_user,
        tenant_id,
        acting_doctor=acting_doctor,
        rbac_action="update_patient",
    )
    update_data = patient_in.model_dump(exclude_unset=True)
    if not update_data:
        return patient
    updated = crud_patient.update_patient(db, patient, update_data)
    log_audit_mutation(
        "update",
        current_user,
        "patient",
        updated.id,
        updated.tenant_id,
    )
    return updated


def delete_patient(
    db: Session,
    patient_id: UUID,
    current_user: User,
    tenant_id: UUID | None,
    *,
    acting_doctor: Doctor | None = None,
) -> None:
    patient = get_patient_or_404(db, patient_id)
    authorize_patient_delete(
        db,
        patient,
        current_user,
        tenant_id,
        acting_doctor=acting_doctor,
        rbac_action="delete_patient",
    )
    log_audit_mutation(
        "delete",
        current_user,
        "patient",
        patient.id,
        patient.tenant_id,
    )
    crud_patient.delete_patient(db, patient)
