from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.inventory import InventoryItemType


class InventoryItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: InventoryItemType
    unit: str = Field(..., min_length=1, max_length=64)
    cost_price: float = Field(..., ge=0)
    selling_price: float = Field(..., ge=0)
    is_active: bool = True


class InventoryItemUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    type: InventoryItemType | None = None
    unit: str | None = Field(None, min_length=1, max_length=64)
    cost_price: float | None = Field(None, ge=0)
    selling_price: float | None = Field(None, ge=0)
    is_active: bool | None = None


class InventoryItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    name: str
    type: InventoryItemType
    unit: str
    cost_price: float
    selling_price: float
    is_active: bool
    created_at: datetime


class StockAddRequest(BaseModel):
    item_id: UUID
    quantity: int = Field(..., ge=1)
    doctor_id: UUID | None = None
    billing_id: UUID | None = None


class StockReduceRequest(BaseModel):
    item_id: UUID
    quantity: int = Field(..., ge=1)
    doctor_id: UUID | None = None
    billing_id: UUID | None = None


class StockAdjustRequest(BaseModel):
    item_id: UUID
    quantity: int = Field(...)  # signed delta for ADJUST
    doctor_id: UUID | None = None
    billing_id: UUID | None = None

    @model_validator(mode="after")
    def quantity_non_zero(self) -> "StockAdjustRequest":
        if self.quantity == 0:
            raise ValueError("Adjustment quantity cannot be zero")
        return self


class StockOperationResult(BaseModel):
    item_id: UUID
    doctor_id: UUID | None
    quantity: int
    movement_id: UUID
