from uuid import UUID

from sqlalchemy.orm import Session

from app.core.tenancy import DEFAULT_TENANT_ID
from app.crud import crud_doctor
from app.models.doctor import Doctor
from app.schemas.doctor import DoctorCreate, DoctorUpdate
from app.services.exceptions import NotFoundError, ValidationError


def _validate_experience_years(experience_years: int | None) -> None:
    if experience_years is not None and experience_years < 0:
        raise ValidationError("Experience years must be greater than or equal to 0")


def create_doctor(
    db: Session,
    doctor_in: DoctorCreate,
    tenant_id: UUID | None = None,
    user_id: UUID | None = None,
) -> Doctor:
    _validate_experience_years(doctor_in.experience_years)
    doctor_data = doctor_in.model_dump()
    doctor_data["tenant_id"] = tenant_id or DEFAULT_TENANT_ID
    if user_id is not None:
        doctor_data["user_id"] = user_id
    return crud_doctor.create_doctor(db, doctor_data)


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
    skip: int = 0,
    limit: int = 10,
    search: str | None = None,
    tenant_id: UUID | None = None,
) -> list[Doctor]:
    return crud_doctor.get_doctors(
        db,
        skip=skip,
        limit=limit,
        search=search,
        tenant_id=tenant_id,
    )


def update_doctor(
    db: Session,
    doctor_id: UUID,
    doctor_in: DoctorUpdate,
) -> Doctor:
    _validate_experience_years(doctor_in.experience_years)
    doctor = get_doctor_or_404(db, doctor_id)
    update_data = doctor_in.model_dump(exclude_unset=True)
    if not update_data:
        return doctor
    return crud_doctor.update_doctor(db, doctor, update_data)


def delete_doctor(db: Session, doctor_id: UUID) -> None:
    doctor = get_doctor_or_404(db, doctor_id)
    crud_doctor.delete_doctor(db, doctor)
