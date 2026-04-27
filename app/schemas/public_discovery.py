from __future__ import annotations

from datetime import datetime
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
    next_available_slot: datetime | None = Field(
        default=None,
        description="Earliest bookable slot from now (UTC ISO); null if none within the scan window",
    )
    available_today: bool = Field(
        default=False,
        description="True if at least one bookable slot remains later today (doctor-local calendar)",
    )
    rating_average: float = Field(
        default=4.8,
        ge=0,
        le=5,
        description="Placeholder until real reviews; shown for conversion",
    )
    review_count: int = Field(
        default=124,
        ge=0,
        description="Placeholder review count for marketplace display",
    )
    distance_km: float = Field(
        default=2.3,
        ge=0,
        description="Illustrative distance (placeholder; replace with geolocation when available)",
    )
    slots_today_count: int = Field(
        default=0,
        ge=0,
        description="Bookable slots remaining today (doctor-local calendar)",
    )
    slots_tomorrow_count: int = Field(
        default=0,
        ge=0,
        description="Bookable slots on the next calendar day (doctor-local)",
    )
    metrics_are_synthetic: bool = Field(
        default=True,
        description="When True, clients must label rating/distance/patient-volume as illustrative, not verified",
    )


class PublicTenantDoctorBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    specialization: str
    availability_status: str = Field(
        default="none",
        description="available_today | next_available_tomorrow | none (same as doctor list hint)",
    )
    next_available_slot: datetime | None = None
    available_today: bool = False
    rating_average: float = 4.8
    review_count: int = 124
    distance_km: float = 2.3
    slots_today_count: int = 0
    slots_tomorrow_count: int = 0
    metrics_are_synthetic: bool = True


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
