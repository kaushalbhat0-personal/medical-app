from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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
