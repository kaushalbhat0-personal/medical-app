from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.doctor import Doctor, DoctorCreationIdempotency
from app.models.tenant import Tenant


def get_doctor_idempotency_record(
    db: Session, user_id: UUID, idempotency_key: str
) -> DoctorCreationIdempotency | None:
    stmt = select(DoctorCreationIdempotency).where(
        DoctorCreationIdempotency.user_id == user_id,
        DoctorCreationIdempotency.idempotency_key == idempotency_key,
    )
    return db.scalars(stmt).first()


def record_doctor_idempotency(
    db: Session,
    *,
    user_id: UUID,
    idempotency_key: str,
    request_hash: str,
    doctor_id: UUID,
) -> DoctorCreationIdempotency:
    row = DoctorCreationIdempotency(
        user_id=user_id,
        idempotency_key=idempotency_key,
        request_hash=request_hash,
        doctor_id=doctor_id,
    )
    db.add(row)
    db.flush()
    return row


def create_doctor(db: Session, doctor_data: dict[str, Any]) -> Doctor:
    doctor = Doctor(**doctor_data)
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor


def create_doctor_tx(db: Session, doctor_data: dict[str, Any]) -> Doctor:
    """
    Create a doctor within an existing transaction (no commit).
    """
    doctor = Doctor(**doctor_data)
    db.add(doctor)
    db.flush()
    db.refresh(doctor)
    return doctor


def get_doctor(db: Session, doctor_id: UUID) -> Doctor | None:
    stmt = select(Doctor).where(
        Doctor.id == doctor_id,
        Doctor.is_deleted == False,
    )
    return db.scalars(stmt).first()


def get_active_doctor_for_user_in_tenant(
    db: Session,
    *,
    user_id: UUID,
    tenant_id: UUID,
) -> Doctor | None:
    stmt = select(Doctor).where(
        Doctor.user_id == user_id,
        Doctor.tenant_id == tenant_id,
        Doctor.is_deleted == False,
        Doctor.is_active == True,
    )
    return db.scalars(stmt).first()


def get_doctor_by_user_id(db: Session, user_id: UUID) -> Doctor | None:
    stmt = (
        select(Doctor)
        .options(joinedload(Doctor.tenant))
        .where(
            Doctor.user_id == user_id,
            Doctor.is_deleted == False,
        )
    )
    return db.scalars(stmt).unique().first()


def get_doctors(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    search: str | None = None,
    tenant_id: UUID | None = None,
    user_id: UUID | None = None,
    specialization: str | None = None,
) -> list[Doctor]:
    stmt = (
        select(Doctor)
        .order_by(Doctor.created_at.desc())
        .options(joinedload(Doctor.tenant), joinedload(Doctor.user))
        .where(
            Doctor.is_active == True,
            Doctor.is_deleted == False,
        )
    )
    if search:
        stmt = stmt.where(Doctor.name.ilike(f"%{search}%"))
    if specialization:
        stmt = stmt.where(Doctor.specialization.ilike(f"%{specialization}%"))
    if user_id is not None:
        stmt = stmt.where(Doctor.user_id == user_id)
    if tenant_id is not None:
        stmt = stmt.where(Doctor.tenant_id == tenant_id)
    # Public listing safety: only show doctors attached to active tenants
    stmt = stmt.join(Doctor.tenant).where(Tenant.is_active == True)
    stmt = stmt.offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def update_doctor(
    db: Session,
    doctor: Doctor,
    update_data: dict[str, Any],
) -> Doctor:
    for field, value in update_data.items():
        setattr(doctor, field, value)

    if "timezone" in update_data:
        from app.core.slot_cache_invalidation import schedule_invalidate_doctor_slot_cache_on_commit

        schedule_invalidate_doctor_slot_cache_on_commit(db, doctor.id)

    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor


def count_active_doctors_by_tenant_ids(
    db: Session,
    tenant_ids: list[UUID],
) -> dict[UUID, int]:
    """Active, non-deleted doctor counts per tenant (for derived org labels)."""
    if not tenant_ids:
        return {}
    stmt = (
        select(Doctor.tenant_id, func.count(Doctor.id))
        .where(
            Doctor.tenant_id.in_(tenant_ids),
            Doctor.is_active == True,  # noqa: E712
            Doctor.is_deleted == False,  # noqa: E712
        )
        .group_by(Doctor.tenant_id)
    )
    return {row[0]: int(row[1]) for row in db.execute(stmt).all()}


def delete_doctor(db: Session, doctor: Doctor) -> None:
    db.delete(doctor)
    db.commit()
