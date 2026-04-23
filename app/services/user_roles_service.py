"""Derive effective application roles: account `User.role` plus `doctor` when a doctor row is linked."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.user import User, UserRole
from app.schemas.user import UserRead, UserResponse


def _linked_doctor_id(db: Session, user: User) -> uuid.UUID | None:
    return db.execute(
        select(Doctor.id).where(
            Doctor.user_id == user.id,
            Doctor.is_deleted.is_(False),
        ).limit(1)
    ).scalar_one_or_none()


def compute_roles_for_user(db: Session, user: User) -> list[str]:
    """Return distinct roles, preserving account role order then appending `doctor` if a profile is linked."""
    roles, _did = roles_and_doctor_id_for_user(db, user)
    return roles


def roles_and_doctor_id_for_user(db: Session, user: User) -> tuple[list[str], uuid.UUID | None]:
    """Single-query friendly: roles for JWT/UI plus linked doctor row id (if any)."""
    did = _linked_doctor_id(db, user)
    seen: set[str] = set()
    out: list[str] = []
    if user.role is not None:
        v = user.role.value
        if v not in seen:
            seen.add(v)
            out.append(v)
    if did is not None:
        dv = UserRole.doctor.value
        if dv not in seen:
            out.append(dv)
    return out, did


def user_read_with_roles(db: Session, user: User) -> UserRead:
    base = UserRead.model_validate(user)
    roles, doctor_id = roles_and_doctor_id_for_user(db, user)
    return base.model_copy(update={"roles": roles, "doctor_id": doctor_id})


def user_response_with_roles(db: Session, user: User) -> UserResponse:
    base = UserResponse.model_validate(user)
    roles, doctor_id = roles_and_doctor_id_for_user(db, user)
    return base.model_copy(update={"roles": roles, "doctor_id": doctor_id})
