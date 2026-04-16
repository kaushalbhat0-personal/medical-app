from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.crud import crud_appointment
from app.models.appointment import Appointment
from app.services import doctor_service, patient_service
from app.services.exceptions import ConflictError, NotFoundError
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate


def _validate_patient_and_doctor_exist(
    db: Session,
    patient_id: UUID,
    doctor_id: UUID,
) -> None:
    patient_service.get_patient_or_404(db, patient_id)
    doctor_service.get_doctor_or_404(db, doctor_id)


def _validate_doctor_availability(
    db: Session,
    doctor_id: UUID,
    appointment_time: datetime,
    existing_appointment_id: UUID | None = None,
) -> None:
    booked_appointment = crud_appointment.get_doctor_appointment_at_time(
        db,
        doctor_id=doctor_id,
        appointment_time=appointment_time,
    )
    if booked_appointment is None:
        return
    if (
        existing_appointment_id is not None
        and booked_appointment.id == existing_appointment_id
    ):
        return
    raise ConflictError("Doctor is already booked at the selected appointment time")


def create_appointment(db: Session, appointment_in: AppointmentCreate) -> Appointment:
    _validate_patient_and_doctor_exist(
        db,
        patient_id=appointment_in.patient_id,
        doctor_id=appointment_in.doctor_id,
    )
    _validate_doctor_availability(
        db,
        doctor_id=appointment_in.doctor_id,
        appointment_time=appointment_in.appointment_time,
    )
    appointment_data = appointment_in.model_dump()
    return crud_appointment.create_appointment(db, appointment_data)


def get_appointment_or_404(db: Session, appointment_id: UUID) -> Appointment:
    appointment = crud_appointment.get_appointment(db, appointment_id)
    if appointment is None:
        raise NotFoundError("Appointment not found")
    return appointment


def get_appointments(
    db: Session,
    skip: int = 0,
    limit: int = 10,
) -> list[Appointment]:
    return crud_appointment.get_appointments(db, skip=skip, limit=limit)


def update_appointment(
    db: Session,
    appointment_id: UUID,
    appointment_in: AppointmentUpdate,
) -> Appointment:
    appointment = get_appointment_or_404(db, appointment_id)
    update_data = appointment_in.model_dump(exclude_unset=True)
    if not update_data:
        return appointment

    patient_id = update_data.get("patient_id", appointment.patient_id)
    doctor_id = update_data.get("doctor_id", appointment.doctor_id)
    appointment_time = update_data.get("appointment_time", appointment.appointment_time)

    _validate_patient_and_doctor_exist(db, patient_id=patient_id, doctor_id=doctor_id)
    _validate_doctor_availability(
        db,
        doctor_id=doctor_id,
        appointment_time=appointment_time,
        existing_appointment_id=appointment.id,
    )
    return crud_appointment.update_appointment(db, appointment, update_data)
