"""
Nurse workflow API endpoints for nursing staff operational actions.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_active_user,
    get_optional_scoped_tenant_id,
)
from app.core.database import get_db
from app.models.user import User
from app.schemas.appointment import AppointmentRead
from app.schemas.clinic_queue import QueueEntryRead, RoomAssignment
from app.services import nurse_workflow_service

router = APIRouter(
    prefix="/appointments",
    tags=["nurse-workflow"],
)


class VitalsData(BaseModel):
    temperature: float | None = None
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    pulse: int | None = None
    respiratory_rate: int | None = None
    spo2: int | None = None
    weight: float | None = None
    height: float | None = None
    notes: str | None = None


@router.post("/{appointment_id}/vitals-complete", response_model=AppointmentRead)
def mark_vitals_completed(
    appointment_id: UUID,
    vitals: VitalsData = Body(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID | None = Depends(get_optional_scoped_tenant_id),
):
    """Record vitals and mark vitals as completed for an appointment."""
    if not tenant_id:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required",
        )
    return nurse_workflow_service.mark_vitals_completed(
        db,
        appointment_id,
        current_user.id,
        tenant_id,
        vitals_data=vitals.model_dump(exclude_none=True) if vitals else None,
    )


@router.post("/{appointment_id}/send-to-doctor", response_model=AppointmentRead)
def send_to_doctor_queue(
    appointment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID | None = Depends(get_optional_scoped_tenant_id),
):
    """Send patient to the doctor waiting queue."""
    if not tenant_id:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required",
        )
    return nurse_workflow_service.send_to_doctor_queue(
        db, appointment_id, current_user.id, tenant_id
    )


@router.put("/{appointment_id}/room", response_model=QueueEntryRead)
def assign_room(
    appointment_id: UUID,
    room: RoomAssignment,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID | None = Depends(get_optional_scoped_tenant_id),
):
    """Assign a room number to an appointment's queue entry."""
    if not tenant_id:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required",
        )
    from app.services.queue_service import _enrich_entry

    entry = nurse_workflow_service.assign_room(
        db, appointment_id, room.room_number, current_user.id, tenant_id
    )
    return _enrich_entry(entry)
