"""Pydantic schemas for procurement (suppliers, purchase orders, reports)."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


# ── Supplier ────────────────────────────────────────────────────────────────


class SupplierCreate(BaseModel):
    supplier_name: str = Field(..., max_length=255)
    contact_person: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=32)
    email: str | None = Field(None, max_length=255)
    address: str | None = None
    gst_number: str | None = Field(None, max_length=64)
    tax_id: str | None = Field(None, max_length=64)
    notes: str | None = None
    is_active: bool = True


class SupplierUpdate(BaseModel):
    supplier_name: str | None = Field(None, max_length=255)
    contact_person: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=32)
    email: str | None = Field(None, max_length=255)
    address: str | None = None
    gst_number: str | None = Field(None, max_length=64)
    tax_id: str | None = Field(None, max_length=64)
    notes: str | None = None
    is_active: bool | None = None


class SupplierResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    supplier_name: str
    contact_person: str | None
    phone: str | None
    email: str | None
    address: str | None
    gst_number: str | None
    tax_id: str | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SupplierListResponse(BaseModel):
    suppliers: list[SupplierResponse]
    total: int


# ── Purchase Order ──────────────────────────────────────────────────────────


class PurchaseOrderItemCreate(BaseModel):
    inventory_item_id: UUID
    quantity: int = Field(..., gt=0)
    unit_cost: Decimal = Field(..., ge=0)
    tax_percent: Decimal = Field(default=Decimal("0.00"), ge=0)
    batch_number: str | None = Field(None, max_length=128)
    expiry_date: date | None = None
    line_total: Decimal = Field(..., ge=0)


class PurchaseOrderCreate(BaseModel):
    supplier_id: UUID
    invoice_number: str | None = Field(None, max_length=128)
    invoice_date: date | None = None
    subtotal: Decimal = Field(default=Decimal("0.00"), ge=0)
    tax_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    discount_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    total_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    payment_status: str = "unpaid"
    payment_method: str | None = Field(None, max_length=64)
    notes: str | None = None
    items: list[PurchaseOrderItemCreate] = Field(..., min_length=1)


class PurchaseOrderItemResponse(BaseModel):
    id: UUID
    purchase_order_id: UUID
    inventory_item_id: UUID
    quantity: int
    unit_cost: Decimal
    tax_percent: Decimal
    batch_number: str | None
    expiry_date: date | None
    line_total: Decimal
    inventory_item_name: str | None = None

    model_config = {"from_attributes": True}


class PurchaseOrderResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    supplier_id: UUID
    invoice_number: str | None
    invoice_date: date | None
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    payment_status: str
    payment_method: str | None
    status: str
    notes: str | None
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime
    supplier_name: str | None = None
    items: list[PurchaseOrderItemResponse] = []

    model_config = {"from_attributes": True}


class PurchaseOrderListResponse(BaseModel):
    purchase_orders: list[PurchaseOrderResponse]
    total: int


# ── Procurement Reports ─────────────────────────────────────────────────────


class ProcurementReportRow(BaseModel):
    purchase_order_id: UUID
    invoice_number: str | None
    invoice_date: date | None
    supplier_name: str
    supplier_gst: str | None
    item_count: int
    total_qty: int
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    status: str
    created_at: datetime


class ProcurementReportResponse(BaseModel):
    rows: list[ProcurementReportRow]
    total_subtotal: Decimal
    total_tax: Decimal
    total_amount: Decimal
    grand_total: Decimal


class TaxSummaryRow(BaseModel):
    supplier_name: str
    gst_number: str | None
    invoice_number: str | None
    invoice_date: date | None
    taxable_value: Decimal
    total_tax: Decimal
    invoice_count: int


class TaxSummaryResponse(BaseModel):
    rows: list[TaxSummaryRow]
    total_taxable_value: Decimal
    total_tax: Decimal


class StockValuationResponse(BaseModel):
    total_items: int
    total_quantity: int
    total_value_at_cost: Decimal
    total_value_at_selling: Decimal


class InwardOutwardValuationRow(BaseModel):
    period: str
    inward_qty: int
    inward_value: Decimal
    outward_qty: int
    outward_value: Decimal


class InwardOutwardValuationResponse(BaseModel):
    rows: list[InwardOutwardValuationRow]
    total_inward_qty: int
    total_inward_value: Decimal
    total_outward_qty: int
    total_outward_value: Decimal
