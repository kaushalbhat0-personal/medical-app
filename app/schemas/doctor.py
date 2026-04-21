from datetime import datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class DoctorCreate(BaseModel):
    name: str
    specialization: str
    experience_years: int
    timezone: str | None = Field(
        default=None,
        description="IANA timezone for availability and slots (e.g. Asia/Kolkata); defaults to UTC",
    )
    account_email: EmailStr | None = Field(
        default=None,
        description="Required with account_password when an administrator creates a doctor under a tenant",
    )
    account_password: str | None = Field(
        default=None,
        description="Login password for the new doctor user (admin/super_admin tenant-scoped creation only); min 8 chars when set",
    )


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
    timezone: str = Field(default="UTC", description="IANA timezone for availability windows and slot dates")
    has_availability_windows: bool = Field(
        default=False,
        description="True if this doctor has at least one recurring availability window configured",
    )
    linked_user_email: str | None = Field(
        default=None,
        description="Email of the linked login user when user_id is set",
    )


class DoctorUpdate(BaseModel):
    name: str | None = None
    specialization: str | None = None
    experience_years: int | None = None
    timezone: str | None = Field(
        default=None,
        description="IANA timezone for availability and slots (e.g. Asia/Kolkata)",
    )


class DoctorSlotRead(BaseModel):
    """One bookable slot start time for a doctor on a given calendar day (UTC)."""

    model_config = ConfigDict(from_attributes=False)

    start: datetime = Field(description="Slot start in UTC")
    available: bool = Field(description="False if an active appointment already occupies this start time")


class DoctorAvailabilityCreate(BaseModel):
    day_of_week: int = Field(ge=0, le=6, description="Monday=0 .. Sunday=6")
    start_time: time
    end_time: time
    slot_duration: int = Field(gt=0, description="Slot length in minutes")


class DoctorAvailabilityUpdate(BaseModel):
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    slot_duration: int | None = Field(default=None, gt=0)


class DoctorAvailabilityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    doctor_id: UUID
    day_of_week: int
    start_time: time
    end_time: time
    slot_duration: int
    tenant_id: UUID
    created_at: datetime
