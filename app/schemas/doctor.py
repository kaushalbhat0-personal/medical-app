from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DoctorCreate(BaseModel):
    name: str
    specialization: str
    experience_years: int


class DoctorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    specialization: str
    experience_years: int
    tenant_id: UUID | None = None
    tenant_type: str | None = None
    tenant_name: str | None = None
    created_at: datetime


class DoctorUpdate(BaseModel):
    name: str | None = None
    specialization: str | None = None
    experience_years: int | None = None
