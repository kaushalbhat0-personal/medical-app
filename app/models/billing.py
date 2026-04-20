import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Numeric, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BillingStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"


class Billing(Base):
    __tablename__ = "billings"

    __table_args__ = (
        # Use unique index with partial condition instead of UniqueConstraint
        Index("uq_billing_appointment", "appointment_id", unique=True, postgresql_where=text("appointment_id IS NOT NULL")),
        UniqueConstraint("idempotency_key", name="uq_billing_idempotency_key"),
        Index("idx_billing_created_by", "created_by"),
        Index("idx_billing_status_paid_at", "status", "paid_at"),
        Index("idx_billing_is_deleted", "is_deleted"),
        Index("idx_paid_bills_only", "paid_at", postgresql_where=text("status = 'paid'")),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=True,
    )
    amount: Mapped[float] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    status: Mapped[BillingStatus] = mapped_column(
        Enum(BillingStatus, name="billingstatus", native_enum=True),
        nullable=False,
        default=BillingStatus.pending,
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    payment_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    payment_method: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    currency: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="INR",
    )
    description: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    idempotency_key: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
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

    patient = relationship("Patient", back_populates="billings")
    appointment = relationship("Appointment", back_populates="billing")
    events = relationship("BillingEvent", back_populates="billing", cascade="all, delete-orphan")


class BillingEvent(Base):
    __tablename__ = "billing_events"

    __table_args__ = (
        Index("idx_billing_events_billing_id", "billing_id"),
        Index("idx_billing_events_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    billing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("billings.id", ondelete="CASCADE"),
        nullable=False,
    )
    previous_status: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    new_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    event_metadata: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    billing = relationship("Billing", back_populates="events")
