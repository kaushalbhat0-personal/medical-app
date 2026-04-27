"""Org/super-admin: list and set doctor marketplace verification (approve / reject / re-open)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.core.permissions import is_admin_or_owner
from app.core.tenant_context import resolve_request_tenant
from app.crud import crud_doctor
from app.models.doctor import Doctor
from app.models.user import User, UserRole
from app.schemas.doctor_profile import (
    DoctorProfileRead,
    DoctorProfileVerificationReview,
    DoctorVerificationQueueItem,
    DoctorVerificationQueuePage,
)
from app.services import doctor_profile_service
from app.services.doctor_service import get_doctor_or_404_with_tenant
from app.services.exceptions import ForbiddenError, ValidationError

router = APIRouter(tags=["admin", "doctor-verification"])


def _queue_item_from_doctor(d: Doctor) -> DoctorVerificationQueueItem:
    t = d.tenant
    prof = d.structured_profile
    st = (prof.verification_status if prof is not None else "draft")
    reason = (
        prof.verification_rejection_reason if prof is not None else None
    )
    return DoctorVerificationQueueItem(
        doctor_id=d.id,
        doctor_name=(d.name or (prof.full_name if prof is not None else "")) or "",
        tenant_id=d.tenant_id,
        tenant_name=(t.name if t is not None else "") or "",
        tenant_type=(t.type if t is not None else "organization") or "organization",
        verification_status=st,
        verification_rejection_reason=reason,
    )


@router.get("/doctor-profiles", response_model=DoctorVerificationQueuePage)
def list_doctor_verification_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    x_tenant_id: UUID | None = Header(default=None, alias="X-Tenant-ID"),
    verification_status: str | None = Query(
        default=None,
        description="Filter: pending | approved | rejected | draft",
    ),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
) -> DoctorVerificationQueuePage:
    """
    List doctors with structured profiles, optionally filtered by ``verification_status``.

    - ``super_admin``: all tenants, unless ``X-Tenant-ID`` is set to scope to one org.
    - Organization admins: only their tenant (same as other scoped org APIs).
    """
    try:
        scope_tenant = resolve_request_tenant(db, current_user, x_tenant_id)
    except (ForbiddenError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN
            if isinstance(e, ForbiddenError)
            else status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    if current_user.role != UserRole.super_admin:
        if scope_tenant is None or not is_admin_or_owner(db, current_user, scope_tenant):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required",
            )

    v_raw = (verification_status or "").strip()
    v_filter: str | None = v_raw.lower() if v_raw else None
    total = crud_doctor.count_doctors_with_verification_status(
        db,
        tenant_id=scope_tenant,
        verification_status=v_filter,
    )
    rows = crud_doctor.list_doctors_with_verification_status(
        db,
        tenant_id=scope_tenant,
        verification_status=v_filter,
        skip=skip,
        limit=limit,
    )
    return DoctorVerificationQueuePage(
        items=[_queue_item_from_doctor(d) for d in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.patch("/doctor-profiles/{doctor_id}/verification", response_model=DoctorProfileRead)
def admin_set_doctor_verification(
    doctor_id: UUID,
    payload: DoctorProfileVerificationReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    x_tenant_id: UUID | None = Header(default=None, alias="X-Tenant-ID"),
) -> DoctorProfileRead:
    """
    Resolve the doctor, enforce tenant rules, and update ``doctor_profiles.verification_status``.
    """
    try:
        request_tenant = resolve_request_tenant(db, current_user, x_tenant_id)
    except (ForbiddenError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN
            if isinstance(e, ForbiddenError)
            else status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    doctor = get_doctor_or_404_with_tenant(db, doctor_id)
    try:
        doctor_profile_service.assert_user_can_verify_doctor(
            db,
            current_user,
            doctor,
            request_tenant_id=request_tenant,
        )
    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        ) from e

    row = doctor_profile_service.set_verification_status_admin(
        db,
        doctor_id=doctor_id,
        status=payload.status,
        reason=payload.reason,
        reviewed_by_user_id=current_user.id,
        is_super_admin=current_user.role == UserRole.super_admin,
    )
    db.commit()
    db.refresh(row)
    return DoctorProfileRead.model_validate(row)
