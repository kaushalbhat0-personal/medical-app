from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.appointment import Appointment


def create_appointment(db: Session, appointment_data: dict[str, Any]) -> Appointment:
    appointment = Appointment(**appointment_data)
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


def get_appointment(db: Session, appointment_id: UUID) -> Appointment | None:
    return db.get(Appointment, appointment_id)


def get_appointments(
    db: Session,
    skip: int = 0,
    limit: int = 10,
) -> list[Appointment]:
    stmt = select(Appointment).order_by(Appointment.created_at.desc())
    stmt = stmt.offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def get_doctor_appointment_at_time(
    db: Session,
    doctor_id: UUID,
    appointment_time: datetime,
) -> Appointment | None:
    stmt = select(Appointment).where(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_time == appointment_time,
        Appointment.status == "scheduled",
    )
    return db.scalars(stmt).first()


def update_appointment(
    db: Session,
    appointment: Appointment,
    update_data: dict[str, Any],
) -> Appointment:
    for field, value in update_data.items():
        setattr(appointment, field, value)

    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment
