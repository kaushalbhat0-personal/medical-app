from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.crud import crud_doctor_profile
from app.models.doctor import Doctor
from app.models.doctor_profile import DoctorProfile
from app.schemas.doctor_profile import DoctorProfileUpdate, DoctorProfileWrite


def _blank_to_none(s: str | None) -> str | None:
    if s is None:
        return None
    t = s.strip()
    return t if t else None


def is_profile_complete_fields(profile: DoctorProfile) -> bool:
    return all(
        [
            _blank_to_none(profile.full_name),
            _blank_to_none(profile.specialization),
            _blank_to_none(profile.registration_number),
            _blank_to_none(profile.phone),
        ]
    )


def recompute_is_complete(profile: DoctorProfile) -> None:
    profile.is_profile_complete = is_profile_complete_fields(profile)


def _mirror_to_doctor_roster(db: Session, doctor: Doctor, profile: DoctorProfile) -> None:
    """Keep legacy `doctors` display fields aligned with the structured profile for list/detail APIs."""
    fn = _blank_to_none(profile.full_name)
    if fn:
        doctor.name = fn[:255]
    sp = _blank_to_none(profile.specialization)
    if sp:
        doctor.specialization = sp[:255]
    if profile.experience_years is not None:
        doctor.experience_years = profile.experience_years
    db.add(doctor)


def _apply_write_model(row: DoctorProfile, payload: DoctorProfileWrite) -> None:
    row.full_name = payload.full_name.strip()
    row.phone = _blank_to_none(payload.phone)
    row.profile_image = _blank_to_none(payload.profile_image)
    row.specialization = _blank_to_none(payload.specialization)
    row.experience_years = payload.experience_years
    row.qualification = _blank_to_none(payload.qualification)
    row.registration_number = _blank_to_none(payload.registration_number)
    row.registration_council = _blank_to_none(payload.registration_council)
    row.clinic_name = _blank_to_none(payload.clinic_name)
    row.address = _blank_to_none(payload.address)
    row.city = _blank_to_none(payload.city)
    row.state = _blank_to_none(payload.state)


def ensure_profile_for_doctor(db: Session, doctor: Doctor) -> DoctorProfile:
    """Ensure a `doctor_profiles` row exists; seed from the roster row when new."""
    existing = crud_doctor_profile.get_by_doctor_id(db, doctor.id)
    if existing is not None:
        return existing
    row = crud_doctor_profile.create_profile_tx(
        db,
        data={
            "doctor_id": doctor.id,
            "full_name": doctor.name,
            "specialization": doctor.specialization,
            "experience_years": doctor.experience_years,
            "verification_status": "pending",
        },
    )
    recompute_is_complete(row)
    db.add(row)
    db.flush()
    return row


def get_profile_read_model(db: Session, doctor_id: UUID) -> DoctorProfile | None:
    return crud_doctor_profile.get_by_doctor_id(db, doctor_id)


def upsert_profile_from_write(
    db: Session,
    doctor: Doctor,
    payload: DoctorProfileWrite,
) -> DoctorProfile:
    """Create or replace structured profile fields (POST/PUT body)."""
    row = crud_doctor_profile.get_by_doctor_id(db, doctor.id)
    if row is None:
        row = crud_doctor_profile.create_profile_tx(
            db,
            data={
                "doctor_id": doctor.id,
                "full_name": payload.full_name.strip(),
                "verification_status": "pending",
            },
        )
    _apply_write_model(row, payload)
    row.updated_at = datetime.now(timezone.utc)
    recompute_is_complete(row)
    _mirror_to_doctor_roster(db, doctor, row)
    db.add(row)
    db.flush()
    db.refresh(row)
    return row


def patch_profile(
    db: Session,
    doctor: Doctor,
    payload: DoctorProfileUpdate,
) -> DoctorProfile:
    row = ensure_profile_for_doctor(db, doctor)
    data = payload.model_dump(exclude_unset=True)
    for key, val in data.items():
        if val is None:
            continue
        if key == "full_name":
            row.full_name = str(val).strip()
        elif key == "experience_years":
            row.experience_years = val
        else:
            if isinstance(val, str):
                setattr(row, key, _blank_to_none(val))
            else:
                setattr(row, key, val)
    row.updated_at = datetime.now(timezone.utc)
    recompute_is_complete(row)
    _mirror_to_doctor_roster(db, doctor, row)
    db.add(row)
    db.flush()
    db.refresh(row)
    return row


def doctor_profile_complete_for_user(db: Session, *, user_id: UUID) -> bool | None:
    """None if this login is not linked to a doctor row; else completion flag."""
    from app.crud import crud_doctor

    doctor = crud_doctor.get_doctor_by_user_id(db, user_id)
    if doctor is None:
        return None
    prof = crud_doctor_profile.get_by_doctor_id(db, doctor.id)
    if prof is None:
        return False
    return bool(prof.is_profile_complete)
