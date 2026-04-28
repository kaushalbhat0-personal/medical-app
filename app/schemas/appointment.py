from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.appointment import AppointmentStatus
from app.schemas.inventory import InventoryUseLine
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


class AppointmentInventoryUsageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_id: UUID
    quantity: int
    item_name: str = ""

    @model_validator(mode="before")
    @classmethod
    def _flatten_item_name(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        item = getattr(data, "item", None)
        name = getattr(item, "name", "") if item is not None else ""
        try:
            return {
                "item_id": getattr(data, "item_id"),
                "quantity": getattr(data, "quantity"),
                "item_name": name,
            }
        except AttributeError:
            return data


class AppointmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    doctor_id: UUID
    appointment_time: datetime
    status: AppointmentStatus
    created_by: UUID
    created_at: datetime
    completion_notes: str | None = None

    patient: PatientMini
    doctor: DoctorMini
    inventory_usages: list[AppointmentInventoryUsageRead] = Field(default_factory=list)
    inventory_materials_selling_total: Decimal | None = Field(
        default=None,
        description="Σ quantity × item selling_price for recorded usage (matches billing materials addon).",
    )


class MarkAppointmentCompletedRequest(BaseModel):
    completion_notes: str | None = Field(None, max_length=50_000)
    items: list[InventoryUseLine] = Field(default_factory=list)


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
