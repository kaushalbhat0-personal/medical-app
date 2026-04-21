from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.tenancy import DEFAULT_TENANT_ID
from app.crud import crud_billing
from app.models.appointment import AppointmentStatus
from app.models.billing import Billing, BillingStatus
from app.schemas.billing import BillingCreate, BillingEventRead, BillingUpdate
from app.services import appointment_service, patient_service
from app.services.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError


def _validate_appointment_exists(db: Session, appointment_id: UUID) -> None:
    appointment_service.get_appointment_or_404(db, appointment_id)


def _validate_appointment_not_cancelled(db: Session, appointment_id: UUID) -> None:
    appointment = appointment_service.get_appointment_or_404(db, appointment_id)
    if appointment.status == AppointmentStatus.cancelled:
        raise ValidationError("Cannot create bill for cancelled appointment")


def _validate_no_duplicate_bill(db: Session, appointment_id: UUID) -> None:
    existing_bill = crud_billing.get_bill_by_appointment(db, appointment_id)
    if existing_bill is not None:
        raise ConflictError("Bill already exists for this appointment")


def _validate_idempotency_key(db: Session, idempotency_key: str | None) -> None:
    if idempotency_key is None:
        return
    existing_bill = crud_billing.get_bill_by_idempotency_key(db, idempotency_key)
    if existing_bill is not None:
        raise ConflictError("Request with this idempotency key already processed")


def _validate_patient_matches_appointment(
    db: Session,
    patient_id: UUID,
    appointment_id: UUID,
) -> None:
    appointment = appointment_service.get_appointment_or_404(db, appointment_id)
    if appointment.patient_id != patient_id:
        raise ValidationError("Patient ID does not match appointment's patient")


def _validate_status_regression(
    existing_status: BillingStatus,
    new_status: BillingStatus | None,
) -> None:
    if existing_status == BillingStatus.paid and new_status is not None:
        if new_status != BillingStatus.paid:
            raise ValidationError("Paid bill status cannot be reverted")


def _validate_not_already_paid(existing_status: BillingStatus) -> None:
    if existing_status == BillingStatus.paid:
        raise ValidationError("Bill already paid")


def create_bill(
    db: Session,
    billing_in: BillingCreate,
    created_by: UUID,
    tenant_id: UUID | None = None,
) -> Billing:
    print("[BILLING SERVICE] Creating bill with data:", billing_in.model_dump())

    # Validate patient exists
    try:
        patient_service.get_patient_or_404(db, billing_in.patient_id)
        print("[BILLING SERVICE] Patient validated:", billing_in.patient_id)
    except NotFoundError as e:
        print("[BILLING SERVICE] Patient not found:", billing_in.patient_id)
        raise ValidationError(f"Patient not found: {billing_in.patient_id}")

    # Only validate appointment if provided (optional field)
    if billing_in.appointment_id is not None:
        print("[BILLING SERVICE] Validating appointment:", billing_in.appointment_id)
        _validate_appointment_exists(db, billing_in.appointment_id)
        _validate_appointment_not_cancelled(db, billing_in.appointment_id)
        _validate_no_duplicate_bill(db, billing_in.appointment_id)
        _validate_patient_matches_appointment(
            db,
            patient_id=billing_in.patient_id,
            appointment_id=billing_in.appointment_id,
        )
    _validate_idempotency_key(db, billing_in.idempotency_key)

    billing_data = billing_in.model_dump()
    billing_data["created_by"] = created_by
    billing_data["tenant_id"] = tenant_id or DEFAULT_TENANT_ID
    print("[BILLING SERVICE] Creating bill in DB with data:", billing_data)

    try:
        bill = crud_billing.create_bill(db, billing_data)
        print("[BILLING SERVICE] Bill created successfully:", bill.id)
    except Exception as e:
        print("[BILLING SERVICE] DB ERROR:", str(e))
        raise

    # Create initial billing event
    crud_billing.create_billing_event(
        db,
        billing_id=bill.id,
        previous_status=None,
        new_status=bill.status.value,
        event_type="created",
        event_metadata=f"Bill created with amount {bill.amount} {bill.currency}",
        created_by=created_by,
    )
    return bill


def get_bill_or_404(db: Session, bill_id: UUID) -> Billing:
    bill = crud_billing.get_bill(db, bill_id)
    if bill is None:
        raise NotFoundError("Bill not found")
    return bill


def get_bills(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    patient_id: UUID | None = None,
    appointment_id: UUID | None = None,
    status: BillingStatus | None = None,
    created_by: UUID | None = None,
) -> list[Billing]:
    return crud_billing.get_bills(
        db,
        skip=skip,
        limit=limit,
        patient_id=patient_id,
        appointment_id=appointment_id,
        status=status,
        created_by=created_by,
    )


def validate_ownership(bill: Billing, current_user_id: UUID) -> None:
    if bill.created_by != current_user_id:
        raise ForbiddenError("Not allowed to access this bill")


def update_bill(
    db: Session,
    bill_id: UUID,
    billing_in: BillingUpdate,
    current_user_id: UUID,
) -> Billing:
    bill = get_bill_or_404(db, bill_id)
    validate_ownership(bill, current_user_id)

    update_data = billing_in.model_dump(exclude_unset=True)
    if not update_data:
        return bill

    new_status = update_data.get("status")
    _validate_status_regression(bill.status, new_status)

    # Prevent double payment
    if new_status == BillingStatus.paid:
        _validate_not_already_paid(bill.status)

    # Auto-set paid_at when status changes to paid
    if new_status == BillingStatus.paid and bill.status != BillingStatus.paid:
        update_data["paid_at"] = datetime.now(timezone.utc)

    new_appointment_id = update_data.get("appointment_id", bill.appointment_id)
    new_patient_id = update_data.get("patient_id", bill.patient_id)

    if "appointment_id" in update_data and new_appointment_id != bill.appointment_id:
        _validate_appointment_exists(db, new_appointment_id)
        _validate_appointment_not_cancelled(db, new_appointment_id)
        existing_bill = crud_billing.get_bill_by_appointment(db, new_appointment_id)
        if existing_bill is not None and existing_bill.id != bill_id:
            raise ConflictError("Bill already exists for this appointment")

    if "patient_id" in update_data or "appointment_id" in update_data:
        _validate_patient_matches_appointment(db, new_patient_id, new_appointment_id)

    previous_status = bill.status.value
    updated_bill = crud_billing.update_bill(db, bill, update_data)

    # Create billing event if status changed
    if new_status is not None and new_status != previous_status:
        crud_billing.create_billing_event(
            db,
            billing_id=updated_bill.id,
            previous_status=previous_status,
            new_status=new_status.value,
            event_type="status_changed",
            event_metadata=f"Status changed from {previous_status} to {new_status.value}",
            created_by=current_user_id,
        )

    return updated_bill


def get_total_revenue(db: Session, current_user_id: UUID) -> float:
    return crud_billing.get_total_revenue(db, created_by=current_user_id)


def get_today_revenue(db: Session, current_user_id: UUID) -> float:
    return crud_billing.get_today_revenue(db, created_by=current_user_id)


def get_pending_payments(
    db: Session, current_user_id: UUID
) -> dict[str, int | float]:
    count, total = crud_billing.get_pending_payments(db, created_by=current_user_id)
    return {"count": count, "total_amount": total}


def soft_delete_bill(
    db: Session,
    bill_id: UUID,
    current_user_id: UUID,
) -> Billing:
    bill = get_bill_or_404(db, bill_id)
    validate_ownership(bill, current_user_id)

    if bill.is_deleted:
        raise ValidationError("Bill already deleted")

    previous_status = bill.status.value
    updated_bill = crud_billing.update_bill(db, bill, {"is_deleted": True})

    # Create billing event for soft delete
    crud_billing.create_billing_event(
        db,
        billing_id=updated_bill.id,
        previous_status=previous_status,
        new_status=updated_bill.status.value,
        event_type="soft_deleted",
        event_metadata="Bill soft deleted",
        created_by=current_user_id,
    )
    return updated_bill


def get_billing_history(
    db: Session,
    bill_id: UUID,
    current_user_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[BillingEventRead]:
    bill = get_bill_or_404(db, bill_id)
    validate_ownership(bill, current_user_id)

    events = crud_billing.get_billing_events(db, bill_id, skip=skip, limit=limit)
    return [BillingEventRead.model_validate(event) for event in events]
