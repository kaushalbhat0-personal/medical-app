from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.user import UserRole
from app.schemas.doctor import DoctorCreate
from app.schemas.patient import PatientCreate


class UserCreate(BaseModel):
    email: str
    password: str
    role: UserRole | None = None
    doctor_profile: DoctorCreate | None = None
    patient_profile: PatientCreate | None = None


class OrganizationUserCreate(BaseModel):
    """Super-admin provisioning: tenant-bound admin or staff account."""

    name: str | None = Field(
        default=None,
        max_length=200,
        description="Display label in UI only; not stored until User supports full name",
    )
    email: str
    password: str = Field(min_length=8)
    role: UserRole
    tenant_id: UUID

    @field_validator("role")
    @classmethod
    def role_must_be_org_staff(cls, v: UserRole) -> UserRole:
        if v not in (UserRole.admin, UserRole.staff):
            raise ValueError("role must be admin or staff")
        return v


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    role: UserRole
    is_active: bool
    tenant_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class UserLogin(BaseModel):
    email: str
    password: str


class UserUpdate(BaseModel):
    email: str | None = None
    password: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    role: UserRole
    is_active: bool
    tenant_id: UUID | None = None
    full_name: str = ""

    def __init__(self, **data):
        # Handle missing full_name gracefully
        if "full_name" not in data or data["full_name"] is None:
            data["full_name"] = data.get("email", "").split("@")[0]
        super().__init__(**data)
