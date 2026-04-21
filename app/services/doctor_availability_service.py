from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.crud import crud_doctor_availability
from app.models.doctor_availability import DoctorAvailability
from app.models.user import User
from app.schemas.doctor import DoctorAvailabilityCreate, DoctorAvailabilityUpdate
from app.services import doctor_service
from app.services.exceptions import NotFoundError, ValidationError


def create_availability_window(
    db: Session,
    doctor_id: UUID,
    payload: DoctorAvailabilityCreate,
    current_user: User,
    tenant_id: UUID | None,
) -> DoctorAvailability:
    doctor = doctor_service.get_doctor_or_404(db, doctor_id)
    doctor_service.authorize_doctor_update(db, doctor, current_user, tenant_id)
    if doctor.tenant_id is None:
        raise ValidationError("Doctor tenant is not set")
    if payload.start_time >= payload.end_time:
        raise ValidationError("Availability end time must be after start time")
    try:
        return crud_doctor_availability.create_availability_window(
            db,
            doctor_id=doctor_id,
            day_of_week=payload.day_of_week,
            start_time=payload.start_time,
            end_time=payload.end_time,
            slot_duration=payload.slot_duration,
            tenant_id=doctor.tenant_id,
        )
    except ValueError as e:
        raise ValidationError(str(e)) from e


def update_availability_window(
    db: Session,
    doctor_id: UUID,
    window_id: UUID,
    payload: DoctorAvailabilityUpdate,
    current_user: User,
    tenant_id: UUID | None,
) -> DoctorAvailability:
    doctor = doctor_service.get_doctor_or_404(db, doctor_id)
    doctor_service.authorize_doctor_update(db, doctor, current_user, tenant_id)
    window = crud_doctor_availability.get_availability_window(db, window_id)
    if window is None or window.doctor_id != doctor_id:
        raise NotFoundError("Availability window not found")
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return window
    try:
        return crud_doctor_availability.update_availability_window(
            db,
            window,
            day_of_week=data.get("day_of_week"),
            start_time=data.get("start_time"),
            end_time=data.get("end_time"),
            slot_duration=data.get("slot_duration"),
        )
    except ValueError as e:
        raise ValidationError(str(e)) from e
