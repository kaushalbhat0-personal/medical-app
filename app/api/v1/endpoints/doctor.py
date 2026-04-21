from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import TokenPayload, get_current_auth_context, get_current_user
from app.core.tenant_context import get_current_tenant_id
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
    user_id = auth_ctx.user_id if auth_ctx.role == "doctor" else None
    return doctor_service.create_doctor(db, payload, tenant_id=auth_ctx.tenant_id, user_id=user_id)


@router.get("", response_model=list[DoctorRead])
def read_doctors(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DoctorRead]:
    tenant_id = get_current_tenant_id(current_user, db)
    if current_user.role == "doctor":
        return [doctor_service.get_doctor_by_user_id(db, current_user.id)]
    return doctor_service.get_doctors(db, skip=skip, limit=limit, search=search, tenant_id=tenant_id)


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
