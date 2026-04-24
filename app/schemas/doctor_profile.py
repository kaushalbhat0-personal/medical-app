from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DoctorProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    doctor_id: UUID
    full_name: str
    specialization: str | None = None
    experience_years: int | None = None
    qualification: str | None = None
    registration_number: str | None = None
    registration_council: str | None = None
    clinic_name: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    phone: str | None = None
    profile_image: str | None = None
    is_profile_complete: bool
    verification_status: str
    created_at: datetime
    updated_at: datetime


class DoctorProfileWrite(BaseModel):
    """Create or replace structured profile fields (empty strings are treated as null)."""

    full_name: str = Field(min_length=1, max_length=2000)
    phone: str | None = None
    profile_image: str | None = None
    specialization: str | None = None
    experience_years: int | None = Field(default=None, ge=0, le=80)
    qualification: str | None = None
    registration_number: str | None = None
    registration_council: str | None = None
    clinic_name: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None


class DoctorProfileUpdate(BaseModel):
    """Partial update (same fields as write; all optional)."""

    full_name: str | None = Field(default=None, min_length=1, max_length=2000)
    phone: str | None = None
    profile_image: str | None = None
    specialization: str | None = None
    experience_years: int | None = Field(default=None, ge=0, le=80)
    qualification: str | None = None
    registration_number: str | None = None
    registration_council: str | None = None
    clinic_name: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
