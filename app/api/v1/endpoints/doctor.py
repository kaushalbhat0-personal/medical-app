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
    DoctorDayMeta,
    DoctorRead,
    DoctorScheduleDayRead,
    DoctorSlotRead,
    DoctorTimeOffCreate,
    DoctorTimeOffRead,
    DoctorTimeOffUpdate,
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


@router.get("/{doctor_id}/schedule/day", response_model=DoctorScheduleDayRead)
def read_doctor_schedule_day(
    doctor_id: UUID,
    on_date: date = Query(
        ...,
        alias="date",
        description="Calendar day (YYYY-MM-DD) in the doctor's configured timezone (IANA)",
    ),
    next_from: date | None = Query(
        default=None,
        alias="from",
        description="Start scan for next-available from this calendar day; omit to use today in the doctor's timezone",
    ),
    horizon_days: int = Query(
        default=14,
        ge=1,
        le=60,
        description="Maximum number of calendar days to scan for next available",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DoctorScheduleDayRead:
    tenant_id = get_current_tenant_id(current_user, db)
    slots, full_off, next_s = doctor_slot_service.get_doctor_schedule_day(
        db,
        doctor_id,
        on_date,
        current_user,
        tenant_id,
        next_from=next_from,
        horizon_days=horizon_days,
    )
    return DoctorScheduleDayRead(
        slots=slots, full_day_time_off=full_off, next_available=next_s
    )


@router.get(
    "/{doctor_id}/availability-windows",
    response_model=list[DoctorAvailabilityRead],
)
def list_doctor_availability_windows(
    doctor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DoctorAvailabilityRead]:
    tenant_id = get_current_tenant_id(current_user, db)
    return doctor_availability_service.list_availability_windows(
        db, doctor_id, current_user, tenant_id
    )


@router.get("/{doctor_id}/day-meta", response_model=DoctorDayMeta)
def read_doctor_day_meta(
    doctor_id: UUID,
    on_date: date = Query(
        ...,
        alias="date",
        description="Calendar day (YYYY-MM-DD) in the doctor's configured timezone (IANA)",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DoctorDayMeta:
    tenant_id = get_current_tenant_id(current_user, db)
    full_day = doctor_slot_service.get_doctor_day_meta(db, doctor_id, on_date, current_user, tenant_id)
    return DoctorDayMeta(full_day_time_off=full_day)


@router.get("/{doctor_id}/next-available", response_model=DoctorSlotRead | None)
def read_doctor_next_available_slot(
    doctor_id: UUID,
    from_date: date = Query(
        ...,
        alias="from",
        description="Start scanning from this calendar day (YYYY-MM-DD) in the doctor's timezone",
    ),
    horizon_days: int = Query(
        default=14,
        ge=1,
        le=60,
        description="Maximum number of calendar days to scan from the effective start date",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DoctorSlotRead | None:
    tenant_id = get_current_tenant_id(current_user, db)
    return doctor_slot_service.get_next_available_slot_for_doctor(
        db, doctor_id, from_date, current_user, tenant_id, horizon_days=horizon_days
    )


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


@router.delete(
    "/{doctor_id}/availability-windows/{window_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_doctor_availability_window(
    doctor_id: UUID,
    window_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    tenant_id = get_current_tenant_id(current_user, db)
    try:
        doctor_availability_service.delete_availability_window(
            db, doctor_id, window_id, current_user, tenant_id
        )
        db.commit()
        doctor_slot_service.invalidate_all_slots_cache_for_doctor(doctor_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception:
        db.rollback()
        raise


@router.get(
    "/{doctor_id}/time-off",
    response_model=list[DoctorTimeOffRead],
)
def list_doctor_time_off(
    doctor_id: UUID,
    from_date: date | None = Query(
        default=None,
        description="Filter entries on or after this date (inclusive)",
    ),
    to_date: date | None = Query(
        default=None,
        description="Filter entries on or before this date (inclusive)",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DoctorTimeOffRead]:
    tenant_id = get_current_tenant_id(current_user, db)
    return doctor_availability_service.list_time_off(
        db, doctor_id, current_user, tenant_id, from_date=from_date, to_date=to_date
    )


@router.post(
    "/{doctor_id}/time-off",
    response_model=DoctorTimeOffRead,
    status_code=201,
)
def create_doctor_time_off(
    doctor_id: UUID,
    payload: DoctorTimeOffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DoctorTimeOffRead:
    tenant_id = get_current_tenant_id(current_user, db)
    try:
        row = doctor_availability_service.create_time_off(
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
    "/{doctor_id}/time-off/{time_off_id}",
    response_model=DoctorTimeOffRead,
)
def update_doctor_time_off(
    doctor_id: UUID,
    time_off_id: UUID,
    payload: DoctorTimeOffUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DoctorTimeOffRead:
    tenant_id = get_current_tenant_id(current_user, db)
    try:
        row = doctor_availability_service.update_time_off(
            db, doctor_id, time_off_id, payload, current_user, tenant_id
        )
        db.commit()
        db.refresh(row)
        doctor_slot_service.invalidate_all_slots_cache_for_doctor(doctor_id)
        return row
    except Exception:
        db.rollback()
        raise


@router.delete(
    "/{doctor_id}/time-off/{time_off_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_doctor_time_off(
    doctor_id: UUID,
    time_off_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    tenant_id = get_current_tenant_id(current_user, db)
    try:
        doctor_availability_service.delete_time_off(
            db, doctor_id, time_off_id, current_user, tenant_id
        )
        db.commit()
        doctor_slot_service.invalidate_all_slots_cache_for_doctor(doctor_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
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
