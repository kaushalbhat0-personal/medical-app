"""
Nurse workflow service — lightweight operational actions for nursing staff.

Provides:
- mark_vitals_completed: record vitals and transition to vitals_completed
- send_to_doctor_queue: transition to waiting_for_doctor
- assign_room: room assignment placeholder

This is NOT a full nursing EMR. It provides minimal workflow state transitions
needed for clinic flow.
"""

from __future__ import annotations

import json
import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.crud import crud_appointment, crud_clinic_queue
from app.models.appointment import Appointment, AppointmentStatus
from app.models.clinic_queue import ClinicQueueEntry, ClinicQueueStatus
from app.schemas.clinic_queue import RoomAssignment
from app.services.exceptions import NotFoundError, ValidationError
from app.services.queue_service import assign_room as queue_assign_room

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Valid state transitions for nurse workflow
# ──────────────────────────────────────────────────────────────────────────────

_VALID_VITALS_FROM = {
    AppointmentStatus.checked_in,
}

_VALID_SEND_TO_DOCTOR_FROM = {
    AppointmentStatus.vitals_completed,
}


def mark_vitals_completed(
    db: Session,
    appointment_id: UUID,
    current_user_id: UUID,
    tenant_id: UUID,
    vitals_data: dict | None = None,
) -> Appointment:
    """Record vitals and transition appointment to vitals_completed.

    Args:
        db: Database session
        appointment_id: The appointment to update
        current_user_id: The nurse/user performing the action
        tenant_id: Tenant scope
        vitals_data: Optional vitals measurements to record.
            Expected keys: temperature, bp_systolic, bp_diastolic, pulse,
            respiratory_rate, spo2, weight, height, notes

    Returns:
        The updated appointment
    """
    appointment = _get_appointment_for_action(db, appointment_id, tenant_id)

    if appointment.status not in _VALID_VITALS_FROM:
        raise ValidationError(
            f"Cannot mark vitals completed from status '{appointment.status.value}'. "
            f"Valid states: {[s.value for s in _VALID_VITALS_FROM]}"
        )

    old_status = appointment.status
    appointment.status = AppointmentStatus.vitals_completed
    db.add(appointment)
    db.flush()

    # Record vitals if provided
    if vitals_data:
        _record_vitals(db, appointment, vitals_data)
        db.refresh(appointment)

    _log_audit(
        event="vitals_completed_by_nurse",
        appointment=appointment,
        actor_id=current_user_id,
        previous_status=old_status.value,
        new_status=AppointmentStatus.vitals_completed.value,
    )

    logger.info(
        "Vitals completed for appointment %s by user %s",
        appointment_id,
        current_user_id,
    )
    return appointment


def send_to_doctor_queue(
    db: Session,
    appointment_id: UUID,
    current_user_id: UUID,
    tenant_id: UUID,
) -> Appointment:
    """Send patient to the doctor waiting queue.

    Transitions appointment from vitals_completed to waiting_for_doctor.
    """
    appointment = _get_appointment_for_action(db, appointment_id, tenant_id)

    if appointment.status not in _VALID_SEND_TO_DOCTOR_FROM:
        raise ValidationError(
            f"Cannot send to doctor from status '{appointment.status.value}'. "
            f"Valid states: {[s.value for s in _VALID_SEND_TO_DOCTOR_FROM]}"
        )

    old_status = appointment.status
    appointment.status = AppointmentStatus.waiting_for_doctor
    db.add(appointment)
    db.flush()

    _log_audit(
        event="sent_to_doctor_queue",
        appointment=appointment,
        actor_id=current_user_id,
        previous_status=old_status.value,
        new_status=AppointmentStatus.waiting_for_doctor.value,
    )

    logger.info(
        "Appointment %s sent to doctor queue by user %s",
        appointment_id,
        current_user_id,
    )
    return appointment


def assign_room(
    db: Session,
    appointment_id: UUID,
    room_number: str,
    current_user_id: UUID,
    tenant_id: UUID,
) -> ClinicQueueEntry:
    """Assign a room number to the active queue entry for this appointment."""
    appointment = _get_appointment_for_action(db, appointment_id, tenant_id)

    queue_entry = crud_clinic_queue.get_active_queue_entry_for_appointment(
        db, appointment_id
    )
    if not queue_entry:
        raise ValidationError(
            f"No active queue entry found for appointment {appointment_id}. "
            "Patient must be checked in first."
        )

    updated_entry = queue_assign_room(db, queue_entry.id, room_number)

    _log_audit(
        event="room_assigned",
        appointment=appointment,
        actor_id=current_user_id,
        previous_status=appointment.status.value,
        new_status=appointment.status.value,
        extra={"room_number": room_number},
    )

    logger.info(
        "Room %s assigned to appointment %s by user %s",
        room_number,
        appointment_id,
        current_user_id,
    )
    return updated_entry


# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────


def _get_appointment_for_action(
    db: Session,
    appointment_id: UUID,
    tenant_id: UUID,
) -> Appointment:
    """Get and validate an appointment exists and belongs to the tenant."""
    appointment = crud_appointment.get_appointment(db, appointment_id)
    if not appointment:
        raise NotFoundError(f"Appointment {appointment_id} not found")
    if str(appointment.tenant_id) != str(tenant_id):
        raise PermissionError(
            f"Appointment {appointment_id} does not belong to tenant {tenant_id}"
        )
    return appointment


def _record_vitals(
    db: Session,
    appointment: Appointment,
    vitals_data: dict,
) -> None:
    """Record vitals on the appointment's vitals relationship."""
    from app.models.appointment import AppointmentVitals

    # Remove existing vitals if any
    if appointment.vitals:
        db.delete(appointment.vitals)
        db.flush()

    vitals = AppointmentVitals(
        appointment_id=appointment.id,
        temperature=vitals_data.get("temperature"),
        bp_systolic=vitals_data.get("bp_systolic"),
        bp_diastolic=vitals_data.get("bp_diastolic"),
        pulse=vitals_data.get("pulse"),
        respiratory_rate=vitals_data.get("respiratory_rate"),
        weight=vitals_data.get("weight"),
        height=vitals_data.get("height"),
        notes=vitals_data.get("notes"),
    )
    db.add(vitals)
    db.flush()


def _log_audit(
    event: str,
    appointment: Appointment,
    actor_id: UUID,
    previous_status: str,
    new_status: str,
    extra: dict | None = None,
) -> None:
    """Log a structured audit event."""
    audit_logger = logging.getLogger("audit")
    record = {
        "event": event,
        "tenant_id": str(appointment.tenant_id),
        "resource_id": str(appointment.id),
        "actor_id": str(actor_id),
        "appointment_id": str(appointment.id),
        "doctor_id": str(appointment.doctor_id),
        "patient_id": str(appointment.patient_id),
        "previous_status": previous_status,
        "new_status": new_status,
    }
    if extra:
        record.update(extra)
    audit_logger.info("[AUDIT] %s", json.dumps(record))
