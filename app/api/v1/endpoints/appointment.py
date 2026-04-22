from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import (
    get_acting_doctor_optional,
    get_acting_doctor_optional_active,
    get_current_active_user,
    get_current_user,
)
from app.core.tenant_context import get_current_tenant_id
from app.core.database import get_db
from app.models.doctor import Doctor
from app.models.user import User
from app.schemas.appointment import AppointmentCreate, AppointmentRead, AppointmentUpdate
from app.services import appointment_service

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.post("", response_model=AppointmentRead, status_code=201)
def create_appointment(
    response: Response,
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    acting_doctor: Doctor | None = Depends(get_acting_doctor_optional_active),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
) -> AppointmentRead:
    tenant_id = get_current_tenant_id(current_user, db)
    appt, idempotent_replay = appointment_service.create_appointment(
        db,
        payload,
        current_user,
        tenant_id,
        idempotency_key=idempotency_key,
        acting_doctor=acting_doctor,
    )
    if idempotent_replay:
        response.headers["X-Idempotent-Replay"] = "1"
    return appt


@router.get("", response_model=list[AppointmentRead])
def read_appointments(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    doctor_id: UUID | None = None,
    patient_id: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    acting_doctor: Doctor | None = Depends(get_acting_doctor_optional),
) -> list[AppointmentRead]:
    tenant_id = get_current_tenant_id(current_user, db)
    return appointment_service.get_appointments(
        db,
        current_user,
        skip=skip,
        limit=limit,
        doctor_id=doctor_id,
        patient_id=patient_id,
        tenant_id=tenant_id,
        acting_doctor=acting_doctor,
    )


@router.get("/{appointment_id}", response_model=AppointmentRead)
def read_appointment(
    appointment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    acting_doctor: Doctor | None = Depends(get_acting_doctor_optional),
) -> AppointmentRead:
    tenant_id = get_current_tenant_id(current_user, db)
    appointment = appointment_service.get_appointment_or_404(db, appointment_id)
    appointment_service.authorize_appointment_read(
        db,
        appointment,
        current_user,
        tenant_id,
        acting_doctor=acting_doctor,
        rbac_action="read_appointment",
    )
    return appointment


@router.put("/{appointment_id}", response_model=AppointmentRead)
def update_appointment(
    appointment_id: UUID,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    acting_doctor: Doctor | None = Depends(get_acting_doctor_optional),
) -> AppointmentRead:
    tenant_id = get_current_tenant_id(current_user, db)
    return appointment_service.update_appointment(
        db,
        appointment_id,
        payload,
        current_user,
        tenant_id,
        acting_doctor=acting_doctor,
    )


@router.delete("/{appointment_id}", response_model=AppointmentRead)
def delete_appointment(
    appointment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    acting_doctor: Doctor | None = Depends(get_acting_doctor_optional),
) -> AppointmentRead:
    tenant_id = get_current_tenant_id(current_user, db)
    return appointment_service.delete_appointment(
        db,
        appointment_id,
        current_user,
        tenant_id,
        acting_doctor=acting_doctor,
    )
