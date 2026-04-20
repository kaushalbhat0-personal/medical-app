from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.billing import BillingStatus
from app.schemas.patient import PatientRead


class BillingCreate(BaseModel):
    patient_id: UUID
    appointment_id: UUID | None = None
    amount: Decimal
    status: BillingStatus = BillingStatus.pending
    currency: str = "INR"
    idempotency_key: str | None = None
    description: str | None = None
    due_date: datetime | None = None

    @field_validator("appointment_id")
    @classmethod
    def validate_appointment_id(cls, v: UUID | None) -> UUID | None:
        # Allow null for now - service layer handles validation
        return v


class BillingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    appointment_id: UUID
    amount: Decimal
    status: BillingStatus
    description: str | None
    paid_at: datetime | None
    payment_id: str | None
    payment_method: str | None
    currency: str
    idempotency_key: str | None
    is_deleted: bool
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    patient: PatientRead | None = None


class BillingUpdate(BaseModel):
    patient_id: UUID | None = None
    appointment_id: UUID | None = None
    amount: Decimal | None = None
    status: BillingStatus | None = None
    paid_at: datetime | None = None
    payment_id: str | None = None
    payment_method: str | None = None
    currency: str | None = None
    idempotency_key: str | None = None
    is_deleted: bool | None = None


class BillingEventCreate(BaseModel):
    billing_id: UUID
    previous_status: str | None = None
    new_status: str
    event_type: str
    event_metadata: str | None = None


class BillingEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    billing_id: UUID
    previous_status: str | None
    new_status: str
    event_type: str
    event_metadata: str | None
    created_by: UUID | None
    created_at: datetime
