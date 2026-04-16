from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.doctor import Doctor


def create_doctor(db: Session, doctor_data: dict[str, Any]) -> Doctor:
    doctor = Doctor(**doctor_data)
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor


def get_doctor(db: Session, doctor_id: UUID) -> Doctor | None:
    return db.get(Doctor, doctor_id)


def get_doctors(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    search: str | None = None,
) -> list[Doctor]:
    stmt = select(Doctor).order_by(Doctor.created_at.desc())
    if search:
        stmt = stmt.where(Doctor.name.ilike(f"%{search}%"))
    stmt = stmt.offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def update_doctor(
    db: Session,
    doctor: Doctor,
    update_data: dict[str, Any],
) -> Doctor:
    for field, value in update_data.items():
        setattr(doctor, field, value)

    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor
