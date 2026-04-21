from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.models.appointment import Appointment, AppointmentCreationIdempotency, AppointmentStatus
from app.models.patient import Patient


def add_appointment(db: Session, appointment_data: dict[str, Any]) -> Appointment:
    appointment = Appointment(**appointment_data)
    db.add(appointment)
    db.flush()
    db.refresh(appointment)
    return appointment


def create_appointment(db: Session, appointment_data: dict[str, Any]) -> Appointment:
    appointment = add_appointment(db, appointment_data)
    db.commit()
    db.refresh(appointment)
    return appointment


def get_appointment_idempotency_record(
    db: Session, user_id: UUID, idempotency_key: str
) -> AppointmentCreationIdempotency | None:
    stmt = select(AppointmentCreationIdempotency).where(
        AppointmentCreationIdempotency.user_id == user_id,
        AppointmentCreationIdempotency.idempotency_key == idempotency_key,
    )
    return db.scalars(stmt).first()


def delete_expired_appointment_idempotency_records(
    db: Session, *, older_than_days: int = 365
) -> int:
    """Remove stale idempotency rows (run from cron/worker). Returns rows deleted."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    stmt = delete(AppointmentCreationIdempotency).where(
        AppointmentCreationIdempotency.created_at < cutoff
    )
    result = db.execute(stmt)
    return int(result.rowcount or 0)


def record_appointment_idempotency(
    db: Session,
    *,
    user_id: UUID,
    idempotency_key: str,
    request_hash: str,
    appointment_id: UUID,
) -> AppointmentCreationIdempotency:
    row = AppointmentCreationIdempotency(
        user_id=user_id,
        idempotency_key=idempotency_key,
        request_hash=request_hash,
        appointment_id=appointment_id,
    )
    db.add(row)
    db.flush()
    db.refresh(row)
    return row


def get_appointment(db: Session, appointment_id: UUID) -> Appointment | None:
    stmt = select(Appointment).where(
        Appointment.id == appointment_id,
        Appointment.is_deleted == False,
    )
    return db.scalars(stmt).first()


def get_appointments(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    doctor_id: UUID | None = None,
    patient_id: UUID | None = None,
    created_by: UUID | None = None,
    tenant_id: UUID | None = None,
    user_id: UUID | None = None,
) -> list[Appointment]:
    stmt = (
        select(Appointment)
        .where(Appointment.is_deleted == False)
        .order_by(Appointment.created_at.desc())
        .options(
            joinedload(Appointment.patient),
            joinedload(Appointment.doctor),
        )
    )

    if doctor_id is not None:
        stmt = stmt.where(Appointment.doctor_id == doctor_id)
    if patient_id is not None:
        stmt = stmt.where(Appointment.patient_id == patient_id)
    if created_by is not None:
        stmt = stmt.where(Appointment.created_by == created_by)
    if user_id is not None:
        stmt = stmt.join(Appointment.patient).where(Patient.user_id == user_id)
    if tenant_id is not None:
        stmt = stmt.where(Appointment.tenant_id == tenant_id)

    stmt = stmt.offset(skip).limit(limit)
    return list(db.scalars(stmt).unique().all())


def get_doctor_appointment_at_time(
    db: Session,
    doctor_id: UUID,
    appointment_time: datetime,
) -> Appointment | None:
    stmt = select(Appointment).where(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_time == appointment_time,
        Appointment.status == AppointmentStatus.scheduled,
        Appointment.is_deleted == False,
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


def soft_delete_appointment(db: Session, appointment: Appointment) -> Appointment:
    appointment.is_deleted = True
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment
