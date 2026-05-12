import enum
import uuid
from datetime import datetime, date

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PurchaseOrderStatus(str, enum.Enum):
    draft = "draft"
    completed = "completed"
    cancelled = "cancelled"


class PaymentStatus(str, enum.Enum):
    unpaid = "unpaid"
    paid = "paid"
    partial = "partial"


class PurchaseOrder(Base):
    """Represents a purchase order / supplier invoice for stock procurement."""

    __tablename__ = "purchase_orders"

    __table_args__ = (
        Index("ix_purchase_orders_tenant_status", "tenant_id", "status"),
        Index("ix_purchase_orders_tenant_supplier", "tenant_id", "supplier_id"),
        Index("ix_purchase_orders_invoice", "tenant_id", "invoice_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    invoice_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subtotal: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0, server_default="0"
    )
    tax_amount: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0, server_default="0"
    )
    discount_amount: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0, server_default="0"
    )
    total_amount: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0, server_default="0"
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="paymentstatus", native_enum=True),
        nullable=False,
        default=PaymentStatus.unpaid,
        server_default="unpaid",
    )
    payment_method: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[PurchaseOrderStatus] = mapped_column(
        Enum(PurchaseOrderStatus, name="purchaseorderstatus", native_enum=True),
        nullable=False,
        default=PurchaseOrderStatus.draft,
        server_default="draft",
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    tenant = relationship("Tenant")
    supplier = relationship("Supplier", back_populates="purchase_orders")
    items = relationship(
        "PurchaseOrderItem",
        back_populates="purchase_order",
        cascade="all, delete-orphan",
    )
    creator = relationship("User", foreign_keys=[created_by])


class PurchaseOrderItem(Base):
    """Line item within a purchase order."""

    __tablename__ = "purchase_order_items"

    __table_args__ = (
        Index("ix_po_items_order", "purchase_order_id"),
        Index("ix_po_items_item", "inventory_item_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchase_orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id", ondelete="RESTRICT"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_cost: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0, server_default="0"
    )
    tax_percent: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=0, server_default="0"
    )
    batch_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    line_total: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0, server_default="0"
    )

    purchase_order = relationship("PurchaseOrder", back_populates="items")
    inventory_item = relationship("InventoryItem")
