from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.billing import BillingStatus


class BillingCreate(BaseModel):
    patient_id: UUID
    appointment_id: UUID
    amount: Decimal
    status: BillingStatus = BillingStatus.pending
    currency: str = "INR"
    idempotency_key: str | None = None


class BillingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    appointment_id: UUID
    amount: Decimal
    status: BillingStatus
    paid_at: datetime | None
    payment_id: str | None
    payment_method: str | None
    currency: str
    idempotency_key: str | None
    is_deleted: bool
    created_by: UUID
    created_at: datetime
    updated_at: datetime


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
