from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import TokenPayload, get_current_auth_context, get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.doctor import DoctorCreate, DoctorRead, DoctorUpdate
from app.services import doctor_service

router = APIRouter(prefix="/doctors", tags=["doctors"])


@router.post("", response_model=DoctorRead, status_code=201)
def create_doctor(
    payload: DoctorCreate,
    db: Session = Depends(get_db),
    auth_ctx: TokenPayload = Depends(get_current_auth_context),
) -> DoctorRead:
    return doctor_service.create_doctor(db, payload, tenant_id=auth_ctx.tenant_id)


@router.get("", response_model=list[DoctorRead])
def read_doctors(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, min_length=1),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[DoctorRead]:
    return doctor_service.get_doctors(db, skip=skip, limit=limit, search=search)


@router.get("/{doctor_id}", response_model=DoctorRead)
def read_doctor(
    doctor_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DoctorRead:
    return doctor_service.get_doctor_or_404(db, doctor_id)


@router.put("/{doctor_id}", response_model=DoctorRead)
def update_doctor(
    doctor_id: UUID,
    payload: DoctorUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DoctorRead:
    return doctor_service.update_doctor(db, doctor_id, payload)


@router.delete("/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_doctor(
    doctor_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Response:
    doctor_service.delete_doctor(db, doctor_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
