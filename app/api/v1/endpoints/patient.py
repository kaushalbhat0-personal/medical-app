from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_user
from app.core.tenant_context import get_current_tenant_id
from app.core.database import get_db
from app.models.user import User
from app.schemas.patient import PatientCreate, PatientRead, PatientUpdate
from app.services import patient_service

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("", response_model=PatientRead, status_code=201)
def create_patient(
    payload: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> PatientRead:
    tenant_id = get_current_tenant_id(current_user, db)
    return patient_service.create_patient(db, payload, current_user, tenant_id)


@router.get("", response_model=list[PatientRead])
def read_patients(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PatientRead]:
    tenant_id = get_current_tenant_id(current_user, db)
    return patient_service.get_patients(
        db,
        current_user,
        skip=skip,
        limit=limit,
        search=search,
        tenant_id=tenant_id,
    )


@router.get("/{patient_id}", response_model=PatientRead)
def read_patient(
    patient_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PatientRead:
    tenant_id = get_current_tenant_id(current_user, db)
    patient = patient_service.get_patient_or_404(db, patient_id)
    patient_service.authorize_patient_read(db, patient, current_user, tenant_id)
    return patient


@router.put("/{patient_id}", response_model=PatientRead)
def update_patient(
    patient_id: UUID,
    payload: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PatientRead:
    tenant_id = get_current_tenant_id(current_user, db)
    return patient_service.update_patient(
        db, patient_id, payload, current_user, tenant_id
    )


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(
    patient_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    tenant_id = get_current_tenant_id(current_user, db)
    patient_service.delete_patient(db, patient_id, current_user, tenant_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
