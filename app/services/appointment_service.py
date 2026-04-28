from datetime import datetime, timezone
import hashlib
import json
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.data_scope import DataScopeKind, ResolvedDataScope
from app.core.permissions import has_tenant_admin_privileges
from app.crud import crud_appointment
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor import Doctor
from app.models.user import User, UserRole
from app.services import doctor_service, doctor_slot_service, inventory_service, patient_service
from app.utils.appointment_datetime import normalize_appointment_time_utc
from app.services.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.services.security_audit import (
    assert_authorized,
    log_audit_mutation,
    log_rbac_mutation_violation,
)
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentRead,
    AppointmentUpdate,
    MarkAppointmentCompletedRequest,
)

logger = logging.getLogger(__name__)

_NIL_UUID = UUID("00000000-0000-0000-0000-000000000000")


def _non_nil_tenant_id(value: UUID | None) -> UUID | None:
    """Treat NULL and the all-zero UUID sentinel as missing for tenant resolution."""
    if value is None or value == _NIL_UUID:
        return None
    return value


def _appointment_payload_hash(appointment_in: AppointmentCreate) -> str:
    body = appointment_in.model_dump(mode="json")
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _ensure_can_list_appointments(current_user: User) -> None:
    if current_user.role not in (
        UserRole.admin,
        UserRole.super_admin,
        UserRole.doctor,
        UserRole.patient,
        UserRole.staff,
    ):
        log_rbac_mutation_violation(current_user, "appointment")
        raise ForbiddenError("Not authorized")


def _validate_patient_and_doctor_exist(
    db: Session,
    patient_id: UUID,
    doctor_id: UUID,
) -> None:
    patient_service.get_patient_or_404(db, patient_id)
    doctor_service.get_doctor_or_404(db, doctor_id)


def _validate_doctor_availability(
    db: Session,
    doctor_id: UUID,
    appointment_time: datetime,
    existing_appointment_id: UUID | None = None,
) -> None:
    from datetime import timedelta

    appointment_time = normalize_appointment_time_utc(appointment_time)
    start_buffer = appointment_time - timedelta(minutes=30)
    end_buffer = appointment_time + timedelta(minutes=30)

    stmt = select(crud_appointment.Appointment).where(
        crud_appointment.Appointment.doctor_id == doctor_id,
        crud_appointment.Appointment.appointment_time >= start_buffer,
        crud_appointment.Appointment.appointment_time <= end_buffer,
        crud_appointment.Appointment.status == crud_appointment.AppointmentStatus.scheduled,
        crud_appointment.Appointment.is_deleted == False,
    )
    booked_appointments = list(db.scalars(stmt).all())

    for booked in booked_appointments:
        if existing_appointment_id is not None and booked.id == existing_appointment_id:
            continue
        booked_t = normalize_appointment_time_utc(booked.appointment_time)
        if abs((booked_t - appointment_time).total_seconds()) < 1800:
            raise ConflictError("Doctor already has an appointment within 30 minutes of this time slot")


def _validate_appointment_time_in_future(appointment_time: datetime) -> None:
    at = normalize_appointment_time_utc(appointment_time)
    if at <= datetime.now(timezone.utc):
        raise ValidationError("Cannot book past slots")


def _validate_slot_not_double_booked(
    db: Session,
    doctor_id: UUID,
    appointment_time: datetime,
    *,
    exclude_appointment_id: UUID | None = None,
) -> None:
    if crud_appointment.doctor_has_non_cancelled_appointment_at(
        db, doctor_id, appointment_time, exclude_appointment_id=exclude_appointment_id
    ):
        raise ValidationError("Slot already booked")


def _validate_patient_no_other_appointment_same_instant(
    db: Session,
    patient_id: UUID,
    appointment_time: datetime,
    *,
    exclude_appointment_id: UUID | None = None,
) -> None:
    if crud_appointment.patient_has_scheduled_appointment_at(
        db,
        patient_id,
        appointment_time,
        exclude_appointment_id=exclude_appointment_id,
    ):
        raise ValidationError("You already have an appointment at this time")


def authorize_appointment_create(
    db: Session,
    appointment_in: AppointmentCreate,
    current_user: User,
    tenant_id: UUID | None,
    *,
    acting_doctor: Doctor | None = None,
) -> None:
    if current_user.role == UserRole.super_admin:
        return

    if current_user.role in (UserRole.admin, UserRole.staff) or (
        current_user.role == UserRole.doctor and current_user.is_owner
    ):
        if tenant_id is not None:
            doctor = doctor_service.get_doctor_or_404(db, appointment_in.doctor_id)
            assert_authorized(
                "create",
                "appointment",
                current_user,
                tenant_id,
                resource_tenant_id=doctor.tenant_id,
            )
        return

    if current_user.role == UserRole.doctor:
        try:
            doc = acting_doctor or doctor_service.require_doctor_profile(
                db, current_user
            )
        except ForbiddenError:
            log_rbac_mutation_violation(
                current_user, "appointment", action="create_appointment"
            )
            raise
        if doc.id != appointment_in.doctor_id:
            log_rbac_mutation_violation(
                current_user,
                "appointment",
                action="create_appointment",
                tenant_type=doc.tenant.type if doc.tenant else None,
            )
            raise ForbiddenError("Cannot create appointment for another doctor")
        return

    if current_user.role == UserRole.patient:
        try:
            acting_patient = patient_service.get_patient_by_user_id(db, current_user.id)
        except NotFoundError:
            log_rbac_mutation_violation(current_user, "appointment")
            raise ForbiddenError("Patient profile not found for this user")
        if acting_patient.id != appointment_in.patient_id:
            log_rbac_mutation_violation(current_user, "appointment")
            raise ForbiddenError("Cannot create appointment for another patient")
        return

    log_rbac_mutation_violation(current_user, "appointment")
    raise ForbiddenError("Not allowed to create appointments")


def create_appointment(
    db: Session,
    appointment_in: AppointmentCreate,
    current_user: User,
    tenant_id: UUID | None,
    idempotency_key: str | None = None,
    *,
    acting_doctor: Doctor | None = None,
) -> tuple[Appointment, bool]:
    """Returns (appointment, idempotent_replay) where idempotent_replay is True if this response replays a prior create."""
    logger.info(f"[RBAC] role={current_user.role}, user={current_user.id}")
    appt_in = appointment_in
    if current_user.role == UserRole.patient:
        ensured = patient_service.ensure_patient_profile_for_user_tx(
            db, current_user
        )
        appt_in = appt_in.model_copy(update={"patient_id": ensured.id})
    authorize_appointment_create(
        db,
        appt_in,
        current_user,
        tenant_id,
        acting_doctor=acting_doctor,
    )

    if idempotency_key is not None:
        idempotency_key = idempotency_key.strip() or None

    body_hash = _appointment_payload_hash(appt_in)
    if idempotency_key:
        existing = crud_appointment.get_appointment_idempotency_record(
            db, current_user.id, idempotency_key
        )
        if existing is not None:
            if existing.request_hash != body_hash:
                raise ConflictError(
                    "Idempotency key reused with different request payload"
                )
            return (get_appointment_or_404(db, existing.appointment_id), True)

    _validate_patient_and_doctor_exist(
        db,
        patient_id=appt_in.patient_id,
        doctor_id=appt_in.doctor_id,
    )
    doctor = doctor_service.get_doctor_or_404(db, appt_in.doctor_id)
    doctor_service.require_doctor_tenant_for_scheduling(doctor)

    patient_row = patient_service.get_patient_or_404(db, appt_in.patient_id)
    if (
        patient_row.tenant_id is not None
        and doctor.tenant_id is not None
        and patient_row.tenant_id != doctor.tenant_id
    ):
        raise ForbiddenError("Cross-tenant appointment not allowed")

    if patient_row.tenant_id is None and doctor.tenant_id is not None:
        patient_row.tenant_id = doctor.tenant_id
        db.add(patient_row)

    logger.info(
        "[BOOKING_FLOW_V2] patient_id=%s patient_tenant=%s doctor_tenant=%s",
        patient_row.id,
        patient_row.tenant_id,
        doctor.tenant_id,
    )

    doctor_slot_service.assert_appointment_time_matches_doctor_slots(
        db, doctor, appt_in.appointment_time
    )
    _validate_doctor_availability(
        db,
        doctor_id=appt_in.doctor_id,
        appointment_time=appt_in.appointment_time,
    )
    _validate_slot_not_double_booked(db, appt_in.doctor_id, appt_in.appointment_time)
    _validate_patient_no_other_appointment_same_instant(
        db, appt_in.patient_id, appt_in.appointment_time
    )
    _validate_appointment_time_in_future(appt_in.appointment_time)
    appointment_data = appt_in.model_dump()
    appointment_data["created_by"] = current_user.id

    scoped = _non_nil_tenant_id(tenant_id)
    patient_tid = _non_nil_tenant_id(patient_row.tenant_id)
    doctor_tid = _non_nil_tenant_id(doctor.tenant_id)
    if scoped:
        appointment_data["tenant_id"] = scoped
    elif patient_tid:
        appointment_data["tenant_id"] = patient_tid
    elif doctor_tid:
        appointment_data["tenant_id"] = doctor_tid
    else:
        raise ValidationError("Tenant cannot be resolved")
    appointment_data["doctor_id"] = appt_in.doctor_id
    appointment_data["patient_id"] = appt_in.patient_id

    assert appointment_data["tenant_id"] is not None

    try:
        appointment = crud_appointment.add_appointment(db, appointment_data)
        if idempotency_key:
            crud_appointment.record_appointment_idempotency(
                db,
                user_id=current_user.id,
                idempotency_key=idempotency_key,
                request_hash=body_hash,
                appointment_id=appointment.id,
            )
        db.commit()
        db.refresh(appointment)
        doctor_slot_service.invalidate_slots_cache_for_appointment(db, doctor, appointment.appointment_time)
    except IntegrityError as e:
        db.rollback()
        if idempotency_key:
            existing = crud_appointment.get_appointment_idempotency_record(
                db, current_user.id, idempotency_key
            )
            if existing is not None and existing.request_hash == body_hash:
                return (get_appointment_or_404(db, existing.appointment_id), True)
        msg = str(getattr(e, "orig", e))
        if "uq_appointments_doctor_time_active" in msg or "uq_doctor_time" in msg:
            raise ValidationError("Slot already booked") from e
        raise

    log_audit_mutation(
        "create",
        current_user,
        "appointment",
        appointment.id,
        appointment.tenant_id,
    )
    reloaded = crud_appointment.get_appointment(db, appointment.id)
    if reloaded is None:
        raise NotFoundError("Appointment not found")
    return (reloaded, False)


def get_appointment_or_404(db: Session, appointment_id: UUID) -> Appointment:
    appointment = crud_appointment.get_appointment(db, appointment_id)
    if appointment is None:
        raise NotFoundError("Appointment not found")
    return appointment


def get_appointments(
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 10,
    doctor_id: UUID | None = None,
    patient_id: UUID | None = None,
    tenant_id: UUID | None = None,
    *,
    acting_doctor: Doctor | None = None,
    list_type: str | None = None,
    appt_status: AppointmentStatus | None = None,
    data_scope: ResolvedDataScope,
) -> list[Appointment]:
    _ensure_can_list_appointments(current_user)
    logger.info(f"[RBAC] role={current_user.role}, user={current_user.id}")
    eff_doctor_id = doctor_id
    eff_patient_id = patient_id
    eff_tenant_id = tenant_id

    if current_user.role == UserRole.doctor:
        if (
            data_scope.kind == DataScopeKind.tenant
            and has_tenant_admin_privileges(current_user)
        ):
            eff_doctor_id = doctor_id
            eff_patient_id = None
        else:
            doc = acting_doctor or doctor_service.require_doctor_profile(
                db, current_user
            )
            eff_doctor_id = doc.id
            eff_patient_id = None
    elif current_user.role == UserRole.patient:
        patient = patient_service.get_patient_by_user_id(db, current_user.id)
        eff_patient_id = patient.id
        eff_doctor_id = None
    elif current_user.role in (UserRole.admin, UserRole.super_admin, UserRole.staff):
        if (
            data_scope.kind == DataScopeKind.doctor
            and data_scope.doctor_id is not None
        ):
            eff_doctor_id = data_scope.doctor_id

    appointments = crud_appointment.get_appointments(
        db,
        skip=skip,
        limit=limit,
        doctor_id=eff_doctor_id,
        patient_id=eff_patient_id,
        tenant_id=eff_tenant_id,
        list_type=list_type,
        appt_status=appt_status,
    )
    logger.info(
        "[APPOINTMENT_SCOPE] scope=%s eff_doctor_id=%s eff_tenant_id=%s user=%s returned=%d",
        data_scope.kind.value,
        eff_doctor_id,
        eff_tenant_id,
        current_user.id,
        len(appointments),
    )
    return appointments


def _completion_payload_hash(data: MarkAppointmentCompletedRequest) -> str:
    body = data.model_dump(mode="json")
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def appointment_to_read(db: Session, appt: Appointment) -> AppointmentRead:
    from app.services.billing_service import appointment_inventory_materials_selling_total

    total = appointment_inventory_materials_selling_total(db, appt.id)
    base = AppointmentRead.model_validate(appt)
    return base.model_copy(update={"inventory_materials_selling_total": total})


def mark_appointment_completed(
    db: Session,
    appointment_id: UUID,
    current_user: User,
    tenant_id: UUID | None,
    *,
    acting_doctor: Doctor | None = None,
    restrict_to_doctor_id: UUID | None = None,
    completion: MarkAppointmentCompletedRequest | None = None,
    idempotency_key: str | None = None,
) -> tuple[Appointment, bool]:
    """Returns (appointment, idempotent_replay). Replay is True when Idempotency-Key matched a prior body."""
    appointment = crud_appointment.get_appointment_for_update_locked(db, appointment_id)
    if appointment is None:
        raise NotFoundError("Appointment not found")

    authorize_appointment_access(
        db,
        appointment,
        current_user,
        tenant_id,
        acting_doctor=acting_doctor,
        rbac_action="mark_appointment_completed",
        restrict_to_doctor_id=restrict_to_doctor_id,
    )
    if current_user.role != UserRole.doctor:
        raise ForbiddenError("Only the assigned doctor can mark a visit complete")
    doc = acting_doctor or doctor_service.require_doctor_profile(db, current_user)
    if appointment.doctor_id != doc.id:
        raise ForbiddenError("Not your appointment")

    data = completion or MarkAppointmentCompletedRequest()
    ih = idempotency_key.strip() if idempotency_key else ""
    ih = ih or None
    req_hash = _completion_payload_hash(data) if ih else None

    if ih:
        existing = crud_appointment.get_appointment_completion_idempotency_record(
            db,
            appointment_id=appointment_id,
            user_id=current_user.id,
            idempotency_key=ih,
        )
        if existing is not None:
            if existing.request_hash != req_hash:
                raise ConflictError(
                    "Idempotency key reused with different request payload"
                )
            db.commit()
            reloaded = crud_appointment.get_appointment(db, appointment_id)
            if reloaded is None:
                raise NotFoundError("Appointment not found")
            return reloaded, True

    if appointment.status == AppointmentStatus.completed:
        db.commit()
        reloaded = crud_appointment.get_appointment(db, appointment_id)
        if reloaded is None:
            raise NotFoundError("Appointment not found")
        return reloaded, False

    if appointment.status != AppointmentStatus.scheduled:
        raise ValidationError("Only scheduled visits can be completed")

    if data.items:
        inventory_service.consume_inventory_for_appointment(
            db,
            appointment,
            data.items,
            current_user,
            tenant_id,
        )
    if data.completion_notes is not None:
        appointment.completion_notes = data.completion_notes

    appointment.status = AppointmentStatus.completed
    db.add(appointment)
    if ih:
        assert req_hash is not None
        crud_appointment.record_appointment_completion_idempotency(
            db,
            appointment_id=appointment.id,
            user_id=current_user.id,
            idempotency_key=ih,
            request_hash=req_hash,
        )
    db.commit()
    slot_doctor = doctor_service.get_doctor_or_404(db, appointment.doctor_id)
    doctor_slot_service.invalidate_slots_cache_for_appointment(
        db, slot_doctor, appointment.appointment_time
    )
    log_audit_mutation(
        "update",
        current_user,
        "appointment",
        appointment.id,
        appointment.tenant_id,
    )
    reloaded = crud_appointment.get_appointment(db, appointment_id)
    if reloaded is None:
        raise NotFoundError("Appointment not found")
    return reloaded, False


def authorize_appointment_access(
    db: Session,
    appointment: Appointment,
    current_user: User,
    tenant_id: UUID | None,
    *,
    acting_doctor: Doctor | None = None,
    rbac_action: str = "appointment_access",
    restrict_to_doctor_id: UUID | None = None,
) -> None:
    if current_user.role == UserRole.super_admin:
        if (
            restrict_to_doctor_id is not None
            and appointment.doctor_id != restrict_to_doctor_id
        ):
            log_rbac_mutation_violation(
                current_user, "appointment", action=rbac_action
            )
            raise ForbiddenError("Not allowed to access this appointment")
        return

    assert_authorized(
        "access",
        "appointment",
        current_user,
        tenant_id,
        resource_tenant_id=appointment.tenant_id,
    )

    if current_user.role in (UserRole.admin, UserRole.staff):
        if (
            restrict_to_doctor_id is not None
            and appointment.doctor_id != restrict_to_doctor_id
        ):
            log_rbac_mutation_violation(
                current_user, "appointment", action=rbac_action
            )
            raise ForbiddenError("Not allowed to access this appointment")
        return

    if current_user.role == UserRole.doctor and current_user.is_owner:
        if restrict_to_doctor_id is None:
            return
        if appointment.doctor_id == restrict_to_doctor_id:
            return
        log_rbac_mutation_violation(
            current_user, "appointment", action=rbac_action
        )
        raise ForbiddenError("Not allowed to access this appointment")

    if current_user.role == UserRole.doctor:
        doc = acting_doctor or doctor_service.require_doctor_profile(
            db, current_user
        )
        if appointment.doctor_id != doc.id:
            log_rbac_mutation_violation(
                current_user,
                "appointment",
                action=rbac_action,
                tenant_type=doc.tenant.type if doc.tenant else None,
            )
            raise ForbiddenError("Not allowed to access this appointment")
        return

    if current_user.role == UserRole.patient:
        try:
            acting_patient = patient_service.get_patient_by_user_id(db, current_user.id)
        except NotFoundError:
            log_rbac_mutation_violation(current_user, "appointment")
            raise ForbiddenError("Patient profile not found for this user")
        if appointment.patient_id != acting_patient.id:
            log_rbac_mutation_violation(current_user, "appointment")
            raise ForbiddenError("Not allowed to access this appointment")
        return

    log_rbac_mutation_violation(current_user, "appointment")
    raise ForbiddenError("Not allowed to access this appointment")


authorize_appointment_read = authorize_appointment_access
authorize_appointment_update = authorize_appointment_access
authorize_appointment_delete = authorize_appointment_access


def _validate_status_regression(
    existing_status: AppointmentStatus,
    new_status: AppointmentStatus | None,
) -> None:
    if existing_status == AppointmentStatus.completed:
        raise ValidationError("Completed appointment cannot be modified")


def update_appointment(
    db: Session,
    appointment_id: UUID,
    appointment_in: AppointmentUpdate,
    current_user: User,
    tenant_id: UUID | None,
    *,
    acting_doctor: Doctor | None = None,
    restrict_to_doctor_id: UUID | None = None,
) -> Appointment:
    appointment = get_appointment_or_404(db, appointment_id)
    authorize_appointment_access(
        db,
        appointment,
        current_user,
        tenant_id,
        acting_doctor=acting_doctor,
        rbac_action="update_appointment",
        restrict_to_doctor_id=restrict_to_doctor_id,
    )

    update_data = appointment_in.model_dump(exclude_unset=True)
    if not update_data:
        return appointment

    new_status = update_data.get("status")
    _validate_status_regression(appointment.status, new_status)

    patient_id = update_data.get("patient_id", appointment.patient_id)
    doctor_id = update_data.get("doctor_id", appointment.doctor_id)
    appointment_time = update_data.get("appointment_time", appointment.appointment_time)
    prev_doctor_id = appointment.doctor_id
    prev_appointment_time = appointment.appointment_time

    _validate_patient_and_doctor_exist(db, patient_id=patient_id, doctor_id=doctor_id)
    doctor_for_slot = doctor_service.get_doctor_or_404(db, doctor_id)
    if appointment_time != prev_appointment_time or doctor_id != prev_doctor_id:
        doctor_slot_service.assert_appointment_time_matches_doctor_slots(
            db, doctor_for_slot, appointment_time
        )
    _validate_doctor_availability(
        db,
        doctor_id=doctor_id,
        appointment_time=appointment_time,
        existing_appointment_id=appointment.id,
    )
    if appointment_time != prev_appointment_time or doctor_id != prev_doctor_id:
        _validate_slot_not_double_booked(
            db,
            doctor_id,
            appointment_time,
            exclude_appointment_id=appointment.id,
        )
    if (
        appointment_time != prev_appointment_time
        or patient_id != appointment.patient_id
        or doctor_id != prev_doctor_id
    ):
        _validate_patient_no_other_appointment_same_instant(
            db,
            patient_id,
            appointment_time,
            exclude_appointment_id=appointment.id,
        )
    if "appointment_time" in update_data:
        _validate_appointment_time_in_future(appointment_time)
    updated = crud_appointment.update_appointment(db, appointment, update_data)
    if appointment_time != prev_appointment_time or doctor_id != prev_doctor_id:
        doctor_slot_service.invalidate_slots_cache_for_appointment(db, doctor_for_slot, appointment_time)
        prev_doctor = doctor_service.get_doctor_or_404(db, prev_doctor_id)
        doctor_slot_service.invalidate_slots_cache_for_appointment(db, prev_doctor, prev_appointment_time)
    log_audit_mutation(
        "update",
        current_user,
        "appointment",
        updated.id,
        updated.tenant_id,
    )
    reloaded = crud_appointment.get_appointment(db, updated.id)
    if reloaded is None:
        raise NotFoundError("Appointment not found")
    return reloaded


def delete_appointment(
    db: Session,
    appointment_id: UUID,
    current_user: User,
    tenant_id: UUID | None,
    *,
    acting_doctor: Doctor | None = None,
    restrict_to_doctor_id: UUID | None = None,
) -> Appointment:
    appointment = get_appointment_or_404(db, appointment_id)
    authorize_appointment_access(
        db,
        appointment,
        current_user,
        tenant_id,
        acting_doctor=acting_doctor,
        rbac_action="delete_appointment",
        restrict_to_doctor_id=restrict_to_doctor_id,
    )

    if appointment.status == AppointmentStatus.completed:
        raise ValidationError("Completed appointment cannot be deleted")

    slot_doctor = doctor_service.get_doctor_or_404(db, appointment.doctor_id)
    slot_time = appointment.appointment_time
    deleted = crud_appointment.soft_delete_appointment(db, appointment)
    doctor_slot_service.invalidate_slots_cache_for_appointment(db, slot_doctor, slot_time)
    log_audit_mutation(
        "delete",
        current_user,
        "appointment",
        deleted.id,
        deleted.tenant_id,
    )
    reloaded = crud_appointment.get_appointment(db, deleted.id, include_deleted=True)
    if reloaded is None:
        raise NotFoundError("Appointment not found")
    return reloaded
