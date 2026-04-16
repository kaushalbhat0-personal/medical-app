from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.patient import PatientCreate, PatientRead, PatientUpdate
from app.services import patient_service

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("", response_model=PatientRead, status_code=201)
def create_patient(
    payload: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PatientRead:
    return patient_service.create_patient(db, payload, current_user.id)


@router.get("", response_model=list[PatientRead])
def read_patients(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, min_length=1),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[PatientRead]:
    return patient_service.get_patients(db, skip=skip, limit=limit, search=search)


@router.get("/{patient_id}", response_model=PatientRead)
def read_patient(
    patient_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PatientRead:
    return patient_service.get_patient_or_404(db, patient_id)


@router.put("/{patient_id}", response_model=PatientRead)
def update_patient(
    patient_id: UUID,
    payload: PatientUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PatientRead:
    return patient_service.update_patient(db, patient_id, payload)


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(
    patient_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Response:
    patient_service.delete_patient(db, patient_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
