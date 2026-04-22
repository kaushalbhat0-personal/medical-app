from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.appointment import AppointmentStatus
from app.utils.appointment_datetime import normalize_appointment_time_utc


class PatientMini(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class DoctorMini(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    timezone: str


class AppointmentCreate(BaseModel):
    patient_id: UUID
    doctor_id: UUID
    appointment_time: datetime
    status: AppointmentStatus = AppointmentStatus.scheduled

    @field_validator("appointment_time")
    @classmethod
    def _normalize_appointment_time(cls, v: datetime) -> datetime:
        return normalize_appointment_time_utc(v)


class AppointmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    appointment_time: datetime
    status: AppointmentStatus
    created_by: UUID
    created_at: datetime

    patient: PatientMini
    doctor: DoctorMini


class AppointmentUpdate(BaseModel):
    patient_id: UUID | None = None
    doctor_id: UUID | None = None
    appointment_time: datetime | None = None
    status: AppointmentStatus | None = None

    @field_validator("appointment_time")
    @classmethod
    def _normalize_appointment_time(cls, v: datetime | None) -> datetime | None:
        if v is None:
            return None
        return normalize_appointment_time_utc(v)
