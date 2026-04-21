from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.tenancy import DEFAULT_TENANT_ID
from app.crud import crud_appointment
from app.models.appointment import Appointment, AppointmentStatus
from app.services import doctor_service, patient_service
from app.services.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
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
    from datetime import timedelta

    start_buffer = appointment_time - timedelta(minutes=30)
    end_buffer = appointment_time + timedelta(minutes=30)

    stmt = select(crud_appointment.Appointment).where(
        crud_appointment.Appointment.doctor_id == doctor_id,
        crud_appointment.Appointment.appointment_time >= start_buffer,
        crud_appointment.Appointment.appointment_time <= end_buffer,
        crud_appointment.Appointment.status == crud_appointment.AppointmentStatus.scheduled,
        crud_appointment.Appointment.is_deleted == False,
    )
    booked_appointments = list(db.scalars(stmt).all())

    for booked in booked_appointments:
        if existing_appointment_id is not None and booked.id == existing_appointment_id:
            continue
        if abs((booked.appointment_time - appointment_time).total_seconds()) < 1800:
            raise ConflictError("Doctor already has an appointment within 30 minutes of this time slot")


def _validate_appointment_time_in_future(appointment_time: datetime) -> None:
    if appointment_time < datetime.now(timezone.utc):
        raise ValidationError("Cannot book appointment in the past")


def create_appointment(
    db: Session,
    appointment_in: AppointmentCreate,
    created_by: UUID,
    tenant_id: UUID | None = None,
) -> Appointment:
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
    _validate_appointment_time_in_future(appointment_in.appointment_time)
    appointment_data = appointment_in.model_dump()
    appointment_data["created_by"] = created_by
    appointment_data["tenant_id"] = tenant_id or DEFAULT_TENANT_ID
    return crud_appointment.create_appointment(db, appointment_data)


def get_appointment_or_404(db: Session, appointment_id: UUID) -> Appointment:
    appointment = crud_appointment.get_appointment(db, appointment_id)
    if appointment is None:
        raise NotFoundError("Appointment not found")

    # Auto-update status if appointment time has passed
    now = datetime.now(timezone.utc)
    if (
        appointment.status == AppointmentStatus.scheduled
        and appointment.appointment_time < now
    ):
        appointment.status = AppointmentStatus.completed
        db.add(appointment)
        db.commit()
        db.refresh(appointment)

    return appointment


def _update_status_for_past_appointments(
    db: Session,
    appointments: list[Appointment],
) -> list[Appointment]:
    """Auto-update status to completed for past scheduled appointments."""
    now = datetime.now(timezone.utc)
    updated = []

    for apt in appointments:
        if (
            apt.status == AppointmentStatus.scheduled
            and apt.appointment_time < now
        ):
            apt.status = AppointmentStatus.completed
            db.add(apt)
            updated.append(apt)

    if updated:
        db.commit()
        for apt in updated:
            db.refresh(apt)

    return appointments


def get_appointments(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    doctor_id: UUID | None = None,
    patient_id: UUID | None = None,
    created_by: UUID | None = None,
) -> list[Appointment]:
    appointments = crud_appointment.get_appointments(
        db, skip=skip, limit=limit,
        doctor_id=doctor_id,
        patient_id=patient_id,
        created_by=created_by,
    )
    return _update_status_for_past_appointments(db, appointments)


def validate_ownership(appointment: Appointment, current_user_id: UUID) -> None:
    if appointment.created_by != current_user_id:
        raise ForbiddenError("Not allowed to access this appointment")


def _validate_status_regression(
    existing_status: AppointmentStatus,
    new_status: AppointmentStatus | None,
) -> None:
    if existing_status == AppointmentStatus.completed:
        raise ValidationError("Completed appointment cannot be modified")


def update_appointment(
    db: Session,
    appointment_id: UUID,
    appointment_in: AppointmentUpdate,
    current_user_id: UUID,
) -> Appointment:
    appointment = get_appointment_or_404(db, appointment_id)
    validate_ownership(appointment, current_user_id)

    update_data = appointment_in.model_dump(exclude_unset=True)
    if not update_data:
        return appointment

    new_status = update_data.get("status")
    _validate_status_regression(appointment.status, new_status)

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
    if "appointment_time" in update_data:
        _validate_appointment_time_in_future(appointment_time)
    return crud_appointment.update_appointment(db, appointment, update_data)


def delete_appointment(
    db: Session,
    appointment_id: UUID,
    current_user_id: UUID,
) -> Appointment:
    appointment = get_appointment_or_404(db, appointment_id)
    validate_ownership(appointment, current_user_id)

    if appointment.status == AppointmentStatus.completed:
        raise ValidationError("Completed appointment cannot be deleted")

    return crud_appointment.soft_delete_appointment(db, appointment)
