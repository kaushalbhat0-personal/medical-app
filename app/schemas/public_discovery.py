from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PublicDoctorProfileRead(BaseModel):
    """
    GET /api/v1/public/doctors/{id} — marketplace-approved doctor only
    (verification_status = approved; non-approved IDs return 404).
    """

    id: UUID
    full_name: str
    specialization: str
    experience: int = Field(description="Years of experience (from structured profile, else roster)")
    qualification: str | None = None
    clinic_name: str | None = None
    address: str | None = None
    city: str | None = None
    profile_image: str | None = None
    verified: bool = True
    verification_status: str = "approved"
    timezone: str = Field(
        default="Asia/Kolkata",
        description="IANA zone for slot calendar days and wall-clock display",
    )
    has_availability_windows: bool = False


class PublicTenantDoctorBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    specialization: str


class PublicTenantDiscoveryRead(BaseModel):
    """Tenant row for patient marketplace: name, catalog type, and active doctor count."""

    id: UUID
    name: str
    doctor_count: int
    type: str
    organization_label: str = Field(
        description='Derived: "Clinic/Hospital" if more than one active doctor, '
        '"Individual Doctor" if exactly one. Not persisted.',
    )
    sole_doctor: PublicTenantDoctorBrief | None = None
