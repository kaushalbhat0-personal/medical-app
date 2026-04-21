from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_active_user,
    get_current_user,
    get_current_user_optional,
)
from app.core.database import get_db
from app.core.tenant_context import get_current_tenant_id
from app.models.user import User, UserRole
from app.schemas.doctor import DoctorCreate, DoctorRead, DoctorUpdate
from app.services import doctor_service

router = APIRouter(prefix="/doctors", tags=["doctors"])


@router.post("", response_model=DoctorRead, status_code=201)
def create_doctor(
    payload: DoctorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    target_tenant_id: UUID | None = Query(
        default=None,
        alias="tenant_id",
        description="Required for super_admin: target tenant for the new doctor profile",
    ),
) -> DoctorRead:
    effective_tenant_id = get_current_tenant_id(current_user, db)
    if effective_tenant_id is None:
        if current_user.role != UserRole.super_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant context is required to create a doctor profile",
            )
        if target_tenant_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Query parameter tenant_id is required for super administrator doctor creation",
            )
        effective_tenant_id = target_tenant_id
    try:
        doctor = doctor_service.create_doctor(
            db,
            payload,
            tenant_id=effective_tenant_id,
            user_id=None,
            current_user=current_user,
        )
        db.commit()
        db.refresh(doctor)
        return doctor
    except Exception:
        db.rollback()
        raise


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


@router.get("/{doctor_id}", response_model=DoctorRead)
def read_doctor(
    doctor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DoctorRead:
    tenant_id = get_current_tenant_id(current_user, db)
    doctor = doctor_service.get_doctor_or_404(db, doctor_id)
    doctor_service.authorize_doctor_read(db, doctor, current_user, tenant_id)
    return doctor


@router.put("/{doctor_id}", response_model=DoctorRead)
def update_doctor(
    doctor_id: UUID,
    payload: DoctorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DoctorRead:
    tenant_id = get_current_tenant_id(current_user, db)
    return doctor_service.update_doctor(db, doctor_id, payload, current_user, tenant_id)


@router.delete("/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_doctor(
    doctor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    tenant_id = get_current_tenant_id(current_user, db)
    doctor_service.delete_doctor(db, doctor_id, current_user, tenant_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
