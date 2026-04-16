from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.appointment import AppointmentCreate, AppointmentRead, AppointmentUpdate
from app.services import appointment_service

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.post("", response_model=AppointmentRead, status_code=201)
def create_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AppointmentRead:
    return appointment_service.create_appointment(db, payload, current_user.id)


@router.get("", response_model=list[AppointmentRead])
def read_appointments(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    doctor_id: UUID | None = None,
    patient_id: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AppointmentRead]:
    return appointment_service.get_appointments(
        db,
        skip=skip,
        limit=limit,
        doctor_id=doctor_id,
        patient_id=patient_id,
        created_by=current_user.id,
    )


@router.get("/{appointment_id}", response_model=AppointmentRead)
def read_appointment(
    appointment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AppointmentRead:
    appointment = appointment_service.get_appointment_or_404(db, appointment_id)
    appointment_service.validate_ownership(appointment, current_user.id)
    return appointment


@router.put("/{appointment_id}", response_model=AppointmentRead)
def update_appointment(
    appointment_id: UUID,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AppointmentRead:
    return appointment_service.update_appointment(db, appointment_id, payload, current_user.id)


@router.delete("/{appointment_id}", response_model=AppointmentRead)
def delete_appointment(
    appointment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AppointmentRead:
    return appointment_service.delete_appointment(db, appointment_id, current_user.id)
