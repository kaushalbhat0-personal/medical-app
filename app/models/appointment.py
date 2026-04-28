import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, String, Text, UniqueConstraint, desc, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"


class Appointment(Base):
    __tablename__ = "appointments"

    __table_args__ = (
        Index("idx_user_doctor_time", "created_by", "doctor_id", "appointment_time"),
        Index(
            "idx_appointments_patient_tenant",
            "patient_id",
            "tenant_id",
        ),
        Index(
            "ix_appointments_tenant_patient_created",
            "tenant_id",
            "patient_id",
            desc("created_at"),
            postgresql_where=text("is_deleted = false"),
        ),
        # Same-doctor/same-time uniqueness for active visits (~scheduled/completed):
        # Postgres predicates omit cancelled rows so reused slots after cancellation stay usable.
        Index(
            "uq_appointments_doctor_time_active",
            "doctor_id",
            "appointment_time",
            unique=True,
            postgresql_where=text("is_deleted = false AND status <> 'cancelled'::appointmentstatus"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
    )
    appointment_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus, name="appointmentstatus", native_enum=True),
        nullable=False,
        default=AppointmentStatus.scheduled,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    completion_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
    billing = relationship("Billing", back_populates="appointment", uselist=False)
    inventory_usages = relationship(
        "AppointmentInventoryUsage",
        back_populates="appointment",
        cascade="all, delete-orphan",
    )


class AppointmentCreationIdempotency(Base):
    """Stores Idempotency-Key + body hash for POST /appointments deduplication."""

    __tablename__ = "appointment_creation_idempotency"

    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_appointment_idempotency_user_key"),
        Index("ix_appointment_idempotency_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class AppointmentCompletionIdempotency(Base):
    """Idempotency-Key + body hash for POST .../mark-completed deduplication."""

    __tablename__ = "appointment_completion_idempotency"

    __table_args__ = (
        UniqueConstraint(
            "appointment_id",
            "user_id",
            "idempotency_key",
            name="uq_appt_completion_idempotency_appt_user_key",
        ),
        Index("ix_appt_completion_idempotency_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
