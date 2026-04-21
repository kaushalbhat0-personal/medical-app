from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.user import UserRole
from app.schemas.doctor import DoctorCreate
from app.schemas.patient import PatientCreate


class UserCreate(BaseModel):
    email: str
    password: str
    role: UserRole | None = None
    doctor_profile: DoctorCreate | None = None
    patient_profile: PatientCreate | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    role: UserRole
    is_active: bool
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
    full_name: str = ""

    def __init__(self, **data):
        # Handle missing full_name gracefully
        if "full_name" not in data or data["full_name"] is None:
            data["full_name"] = data.get("email", "").split("@")[0]
        super().__init__(**data)
