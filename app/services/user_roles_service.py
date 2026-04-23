"""Derive effective application roles: account `User.role` plus `doctor` when a doctor row is linked."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.user import User, UserRole
from app.schemas.user import UserRead, UserResponse


def compute_roles_for_user(db: Session, user: User) -> list[str]:
    """Return distinct roles, preserving account role order then appending `doctor` if a profile is linked."""
    seen: set[str] = set()
    out: list[str] = []
    if user.role is not None:
        v = user.role.value
        if v not in seen:
            seen.add(v)
            out.append(v)
    has_doctor = (
        db.execute(
            select(Doctor.id)
            .where(
                Doctor.user_id == user.id,
                Doctor.is_deleted.is_(False),
            )
            .limit(1)
        ).scalar_one_or_none()
        is not None
    )
    if has_doctor:
        dv = UserRole.doctor.value
        if dv not in seen:
            out.append(dv)
    return out


def user_read_with_roles(db: Session, user: User) -> UserRead:
    base = UserRead.model_validate(user)
    return base.model_copy(update={"roles": compute_roles_for_user(db, user)})


def user_response_with_roles(db: Session, user: User) -> UserResponse:
    base = UserResponse.model_validate(user)
    return base.model_copy(update={"roles": compute_roles_for_user(db, user)})
