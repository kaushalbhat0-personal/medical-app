from uuid import UUID

from sqlalchemy.orm import Session

from app.core.tenancy import DEFAULT_TENANT_ID
from app.crud import crud_patient
from app.models.patient import Patient
from app.schemas.patient import PatientCreate, PatientUpdate
from app.services.exceptions import NotFoundError, ValidationError


def _validate_age(age: int | None) -> None:
    if age is not None and age < 0:
        raise ValidationError("Age must be greater than or equal to 0")


def create_patient(
    db: Session,
    patient_in: PatientCreate,
    created_by: UUID,
    tenant_id: UUID | None = None,
    user_id: UUID | None = None,
) -> Patient:
    _validate_age(patient_in.age)
    patient_data = patient_in.model_dump()
    patient_data["created_by"] = created_by
    patient_data["tenant_id"] = tenant_id or DEFAULT_TENANT_ID
    if user_id is not None:
        patient_data["user_id"] = user_id
    return crud_patient.create_patient(db, patient_data)


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


def get_patients(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    search: str | None = None,
    tenant_id: UUID | None = None,
) -> list[Patient]:
    return crud_patient.get_patients(
        db,
        skip=skip,
        limit=limit,
        search=search,
        tenant_id=tenant_id,
    )


def update_patient(
    db: Session,
    patient_id: UUID,
    patient_in: PatientUpdate,
) -> Patient:
    _validate_age(patient_in.age)
    patient = get_patient_or_404(db, patient_id)
    update_data = patient_in.model_dump(exclude_unset=True)
    if not update_data:
        return patient
    return crud_patient.update_patient(db, patient, update_data)


def delete_patient(db: Session, patient_id: UUID) -> None:
    patient = get_patient_or_404(db, patient_id)
    crud_patient.delete_patient(db, patient)
