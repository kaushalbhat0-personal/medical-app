from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.sql import exists
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.patient import Patient


def create_patient(db: Session, patient_data: dict[str, Any]) -> Patient:
    patient = Patient(**patient_data)
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


def create_patient_tx(db: Session, patient_data: dict[str, Any]) -> Patient:
    """
    Create a patient within an existing transaction (no commit).
    """
    patient = Patient(**patient_data)
    db.add(patient)
    db.flush()
    db.refresh(patient)
    return patient


def get_patient(db: Session, patient_id: UUID) -> Patient | None:
    return db.get(Patient, patient_id)


def get_patient_by_user_id(db: Session, user_id: UUID) -> Patient | None:
    stmt = select(Patient).where(Patient.user_id == user_id)
    return db.scalars(stmt).first()


def patient_has_appointment_with_doctor(
    db: Session, patient_id: UUID, doctor_id: UUID
) -> bool:
    stmt = select(func.count(Appointment.id)).where(
        Appointment.patient_id == patient_id,
        Appointment.doctor_id == doctor_id,
        Appointment.is_deleted == False,
    )
    n = db.scalar(stmt)
    return bool(n and n > 0)


def patient_has_active_appointment_in_tenant(
    db: Session, patient_id: UUID, tenant_id: UUID
) -> bool:
    stmt = select(func.count(Appointment.id)).where(
        Appointment.patient_id == patient_id,
        Appointment.tenant_id == tenant_id,
        Appointment.is_deleted == False,
    )
    n = db.scalar(stmt)
    return bool(n and n > 0)


def get_patients(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    search: str | None = None,
    tenant_id: UUID | None = None,
    created_by: UUID | None = None,
    user_id: UUID | None = None,
    linked_doctor_id: UUID | None = None,
) -> list[Patient]:
    """
    List patients. Tenant scope: filter by ``tenant_id`` only. Doctor scope:
    pass ``linked_doctor_id`` — rows must have a non-deleted appointment with
    that doctor (optionally also ``Patient.tenant_id``). Do not use
    ``created_by`` for scoping; it is not reliable for cohort membership.
    """
    stmt = select(Patient).order_by(Patient.created_at.desc())
    if search:
        stmt = stmt.where(Patient.name.ilike(f"%{search}%"))
    if linked_doctor_id is not None:
        has_appt = exists().where(
            Appointment.patient_id == Patient.id,
            Appointment.doctor_id == linked_doctor_id,
            Appointment.is_deleted == False,
        )
        stmt = stmt.where(has_appt)
        if tenant_id is not None:
            stmt = stmt.where(Patient.tenant_id == tenant_id)
    elif user_id is not None:
        stmt = stmt.where(Patient.user_id == user_id)
        if tenant_id is not None:
            stmt = stmt.where(Patient.tenant_id == tenant_id)
    elif tenant_id is not None:
        stmt = stmt.where(Patient.tenant_id == tenant_id)
    if created_by is not None:
        stmt = stmt.where(Patient.created_by == created_by)
    stmt = stmt.offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def update_patient(
    db: Session,
    patient: Patient,
    update_data: dict[str, Any],
) -> Patient:
    for field, value in update_data.items():
        setattr(patient, field, value)

    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


def delete_patient(db: Session, patient: Patient) -> None:
    db.delete(patient)
    db.commit()
