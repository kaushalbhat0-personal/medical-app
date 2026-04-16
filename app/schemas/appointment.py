from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

AppointmentStatus = Literal["scheduled", "completed", "cancelled"]


class AppointmentCreate(BaseModel):
    patient_id: UUID
    doctor_id: UUID
    appointment_time: datetime
    status: AppointmentStatus = "scheduled"


class AppointmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    doctor_id: UUID
    appointment_time: datetime
    status: AppointmentStatus
    created_at: datetime


class AppointmentUpdate(BaseModel):
    patient_id: UUID | None = None
    doctor_id: UUID | None = None
    appointment_time: datetime | None = None
    status: AppointmentStatus | None = None
