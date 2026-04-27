"""Org/super-admin: set doctor marketplace verification (approve / reject / re-open)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_scoped_tenant_id_active, require_current_user_admin_or_owner
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.doctor_profile import DoctorProfileRead, DoctorProfileVerificationReview
from app.services import doctor_profile_service
from app.services.doctor_service import get_doctor_or_404_with_tenant

router = APIRouter(tags=["admin", "doctor-verification"])


@router.patch("/doctor-profiles/{doctor_id}/verification", response_model=DoctorProfileRead)
def admin_set_doctor_verification(
    doctor_id: UUID,
    payload: DoctorProfileVerificationReview,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_scoped_tenant_id_active),
    current_user: User = Depends(require_current_user_admin_or_owner),
) -> DoctorProfileRead:
    """
    Resolve the doctor in the active tenant (or any tenant for ``super_admin``) and
    update ``doctor_profiles.verification_status``.
    """
    doctor = get_doctor_or_404_with_tenant(db, doctor_id)
    if current_user.role != UserRole.super_admin and doctor.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor is not in the selected tenant",
        )
    st = payload.status.strip().lower()
    if st == "rejected" and not (payload.reason or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reason is required when rejecting",
        )
    row = doctor_profile_service.set_verification_status_admin(
        db,
        doctor_id=doctor_id,
        status=payload.status,
        reason=payload.reason,
        reviewed_by_user_id=current_user.id,
    )
    db.commit()
    db.refresh(row)
    return DoctorProfileRead.model_validate(row)
