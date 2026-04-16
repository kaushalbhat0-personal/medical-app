from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.appointment import AppointmentStatus


class PatientMini(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class DoctorMini(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class AppointmentCreate(BaseModel):
    patient_id: UUID
    doctor_id: UUID
    appointment_time: datetime
    status: AppointmentStatus = AppointmentStatus.scheduled


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
