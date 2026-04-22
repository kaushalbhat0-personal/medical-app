from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_active_user,
    get_current_user,
    get_current_user_optional,
)
from app.core.database import get_db
from app.core.tenant_context import get_current_tenant_id
from app.models.user import User, UserRole
from app.schemas.doctor import (
    DoctorAvailabilityCreate,
    DoctorAvailabilityRead,
    DoctorAvailabilityUpdate,
    DoctorCreate,
    DoctorRead,
    DoctorSlotRead,
    DoctorUpdate,
)
from app.services import doctor_availability_service, doctor_service, doctor_slot_service
from app.services.exceptions import ValidationError

router = APIRouter(prefix="/doctors", tags=["doctors"])


@router.post("", response_model=DoctorRead, status_code=201)
def create_doctor(
    payload: DoctorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    target_tenant_id: UUID | None = Query(
        default=None,
        alias="tenant_id",
        description="Required for super_admin without primary tenant: target tenant for the new doctor profile",
    ),
) -> DoctorRead:
    effective_tenant_id = get_current_tenant_id(current_user, db)
    if effective_tenant_id is None:
        if current_user.role == UserRole.super_admin and target_tenant_id is not None:
            effective_tenant_id = target_tenant_id
        else:
            raise ValidationError("Tenant context is required to create a doctor profile")
    doctor = doctor_service.create_doctor(
        db,
        payload,
        tenant_id=effective_tenant_id,
        user_id=None,
        current_user=current_user,
        idempotency_key=idempotency_key,
    )
    db.commit()
    db.refresh(doctor)
    doctor_service.hydrate_doctor_availability_flags(db, [doctor])
    return doctor


@router.get("", response_model=list[DoctorRead])
def read_doctors(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, min_length=1),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> list[DoctorRead]:
    tenant_id = (
        get_current_tenant_id(current_user, db) if current_user is not None else None
    )
    return doctor_service.get_doctors(
        db,
        current_user,
        skip=skip,
        limit=limit,
        search=search,
        tenant_id=tenant_id,
    )


@router.get("/{doctor_id}/slots", response_model=list[DoctorSlotRead])
def read_doctor_slots(
    doctor_id: UUID,
    on_date: date = Query(
        ...,
        alias="date",
        description="Calendar day (YYYY-MM-DD) in the doctor's configured timezone (IANA)",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DoctorSlotRead]:
    tenant_id = get_current_tenant_id(current_user, db)
    return doctor_slot_service.get_doctor_slots_for_date(db, doctor_id, on_date, current_user, tenant_id)


@router.post(
    "/{doctor_id}/availability-windows",
    response_model=DoctorAvailabilityRead,
    status_code=201,
)
def create_doctor_availability_window(
    doctor_id: UUID,
    payload: DoctorAvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DoctorAvailabilityRead:
    tenant_id = get_current_tenant_id(current_user, db)
    try:
        row = doctor_availability_service.create_availability_window(
            db, doctor_id, payload, current_user, tenant_id
        )
        db.commit()
        db.refresh(row)
        doctor_slot_service.invalidate_all_slots_cache_for_doctor(doctor_id)
        return row
    except Exception:
        db.rollback()
        raise


@router.put(
    "/{doctor_id}/availability-windows/{window_id}",
    response_model=DoctorAvailabilityRead,
)
def update_doctor_availability_window(
    doctor_id: UUID,
    window_id: UUID,
    payload: DoctorAvailabilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DoctorAvailabilityRead:
    tenant_id = get_current_tenant_id(current_user, db)
    try:
        row = doctor_availability_service.update_availability_window(
            db, doctor_id, window_id, payload, current_user, tenant_id
        )
        db.commit()
        db.refresh(row)
        doctor_slot_service.invalidate_all_slots_cache_for_doctor(doctor_id)
        return row
    except Exception:
        db.rollback()
        raise


@router.get("/{doctor_id}", response_model=DoctorRead)
def read_doctor(
    doctor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DoctorRead:
    tenant_id = get_current_tenant_id(current_user, db)
    doctor = doctor_service.get_doctor_or_404(db, doctor_id)
    doctor_service.authorize_doctor_read(db, doctor, current_user, tenant_id)
    doctor_service.hydrate_doctor_availability_flags(db, [doctor])
    return doctor


@router.put("/{doctor_id}", response_model=DoctorRead)
def update_doctor(
    doctor_id: UUID,
    payload: DoctorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DoctorRead:
    tenant_id = get_current_tenant_id(current_user, db)
    updated = doctor_service.update_doctor(db, doctor_id, payload, current_user, tenant_id)
    if payload.model_dump(exclude_unset=True).get("timezone") is not None:
        doctor_slot_service.invalidate_all_slots_cache_for_doctor(doctor_id)
    return updated


@router.delete("/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_doctor(
    doctor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    tenant_id = get_current_tenant_id(current_user, db)
    doctor_service.delete_doctor(db, doctor_id, current_user, tenant_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
