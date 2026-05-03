"""
Read-only checks for historical / bypass corruption. Run from admin API, cron, or pre-deploy scripts.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.crud import crud_integrity_scan_state
from app.core.config import settings
from app.core.permissions import has_tenant_admin_privileges
from app.core.tenancy import non_nil_tenant_id
from app.models.appointment import Appointment
from app.models.billing import Billing
from app.models.doctor import Doctor
from app.models.inventory import (
    AppointmentInventoryUsage,
    InventoryMovement,
    InventoryMovementType,
    InventoryReferenceType,
)
from app.models.user import User, UserRole
from app.schemas.integrity_scan import IntegrityIssue, IntegrityScanResponse, IntegritySeverity
from app.services.appointment_invariants import validate_appointment_invariants
from app.services.exceptions import ForbiddenError, ValidationError

_CACHE_LOCK = threading.Lock()
_SCAN_CACHE: dict[tuple[bool, str | None], tuple[float, IntegrityScanResponse]] = {}


def _integrity_scope_key(*, all_tenants: bool, tenant_id: UUID | None) -> str:
    if all_tenants:
        return "all"
    assert tenant_id is not None
    return f"tenant:{tenant_id}"


def authorize_integrity_scan(current_user: User, *, all_tenants: bool) -> None:
    if all_tenants:
        if current_user.role != UserRole.super_admin:
            raise ForbiddenError(
                "Cross-tenant integrity scans are restricted to super administrators"
            )
        return
    if not has_tenant_admin_privileges(current_user):
        raise ForbiddenError("Admin access required")


def _severity_for_category(category: str) -> IntegritySeverity:
    if category == "inventory_movement":
        return IntegritySeverity.WARNING
    return IntegritySeverity.CRITICAL


def _sample_key_for(category: str, detail: str) -> str:
    d = detail.lower()
    if category == "appointment_invariant":
        if "missing doctor" in d:
            return "missing_doctor"
        if "organization" in d or "tenant" in d:
            return "tenant_mismatch"
        return "appointment_invariant"
    if category == "billing_alignment":
        if "tenant" in d:
            return "tenant_mismatch"
        if "patient" in d:
            return "patient_mismatch"
        return "billing_alignment"
    if category == "duplicate_bill":
        return "duplicate_bill"
    if category == "inventory_movement":
        return "inventory_movement"
    return category


def _mk_issue(
    *,
    category: str,
    detail: str,
    resource_id: str | None,
    tenant_scope: str | None,
) -> IntegrityIssue:
    return IntegrityIssue(
        category=category,
        severity=_severity_for_category(category),
        sample_key=_sample_key_for(category, detail),
        detail=detail,
        resource_id=resource_id,
        tenant_id=tenant_scope,
    )


def _summarize_issues(issues: list[IntegrityIssue], *, scanned_at: datetime) -> dict:
    MAX_SAMPLES_PER_KEY = 50
    critical_count = sum(1 for i in issues if i.severity == IntegritySeverity.CRITICAL)
    warning_count = sum(1 for i in issues if i.severity == IntegritySeverity.WARNING)
    samples: dict[str, list[str]] = {}
    for i in issues:
        key = i.sample_key or i.category
        sid = i.resource_id
        if sid is None:
            continue
        bucket = samples.setdefault(key, [])
        if len(bucket) < MAX_SAMPLES_PER_KEY and sid not in bucket:
            bucket.append(sid)
    status_ok = critical_count == 0
    return {
        "status": "ok" if status_ok else "issues",
        "ok": status_ok,
        "critical_count": critical_count,
        "warning_count": warning_count,
        "samples": samples,
    }


def scan_system_invariants(
    db: Session,
    *,
    tenant_id: UUID | None = None,
    all_tenants: bool = False,
) -> IntegrityScanResponse:
    """
    Check appointment doctor/tenant alignment, bill linkage, duplicate bills, and
    appointment inventory usage vs stock OUT movements.
    """
    if all_tenants and tenant_id is not None:
        raise ValueError("all_tenants and tenant_id are mutually exclusive")

    if not all_tenants and tenant_id is None:
        raise ValueError("tenant_id is required unless all_tenants is true")

    scanned_at = datetime.now(timezone.utc)
    issues: list[IntegrityIssue] = []
    appt_filter_tenant: UUID | None = None if all_tenants else tenant_id

    appt_stmt = (
        select(Appointment)
        .options(joinedload(Appointment.doctor))
        .where(Appointment.is_deleted == False)
    )
    if appt_filter_tenant is not None:
        appt_stmt = appt_stmt.where(Appointment.tenant_id == appt_filter_tenant)
    appointments = list(db.scalars(appt_stmt).unique().all())
    appointments_checked = len(appointments)

    scoped_tid = str(appt_filter_tenant) if appt_filter_tenant else None

    for appt in appointments:
        doc = appt.doctor
        if doc is None:
            doc = db.get(Doctor, appt.doctor_id)
        tenant_str = str(appt.tenant_id) if appt.tenant_id else None
        if doc is None:
            issues.append(
                _mk_issue(
                    category="appointment_invariant",
                    detail="Appointment references missing doctor row",
                    resource_id=str(appt.id),
                    tenant_scope=tenant_str or scoped_tid,
                )
            )
            continue
        try:
            validate_appointment_invariants(appt, doc)
        except ValidationError as exc:
            issues.append(
                _mk_issue(
                    category="appointment_invariant",
                    detail=str(exc),
                    resource_id=str(appt.id),
                    tenant_scope=tenant_str or scoped_tid,
                )
            )

    bill_stmt = select(Billing).where(
        Billing.is_deleted == False,
        Billing.appointment_id.isnot(None),
    )
    if appt_filter_tenant is not None:
        bill_stmt = bill_stmt.where(Billing.tenant_id == appt_filter_tenant)
    bills = list(db.scalars(bill_stmt).all())

    dup_stmt = (
        select(Billing.appointment_id, func.count(Billing.id))
        .where(
            Billing.is_deleted == False,
            Billing.appointment_id.isnot(None),
        )
        .group_by(Billing.appointment_id)
        .having(func.count(Billing.id) > 1)
    )
    if appt_filter_tenant is not None:
        dup_stmt = dup_stmt.where(Billing.tenant_id == appt_filter_tenant)
    for ap_id, cnt in db.execute(dup_stmt):
        if ap_id is None:
            continue
        issues.append(
            _mk_issue(
                category="duplicate_bill",
                detail=f"More than one non-deleted bill for appointment (count={cnt})",
                resource_id=str(ap_id),
                tenant_scope=scoped_tid,
            )
        )

    for bill in bills:
        assert bill.appointment_id is not None
        appt = db.get(Appointment, bill.appointment_id)
        bill_tid_s = str(bill.tenant_id) if bill.tenant_id else None
        if appt is None or appt.is_deleted:
            issues.append(
                _mk_issue(
                    category="billing_alignment",
                    detail="Bill references missing or soft-deleted appointment",
                    resource_id=str(bill.id),
                    tenant_scope=bill_tid_s,
                )
            )
            continue
        if bill.patient_id != appt.patient_id:
            issues.append(
                _mk_issue(
                    category="billing_alignment",
                    detail="Bill patient_id does not match appointment patient_id",
                    resource_id=str(appt.id),
                    tenant_scope=bill_tid_s,
                )
            )
        ap_tid = non_nil_tenant_id(appt.tenant_id)
        bill_tid = non_nil_tenant_id(bill.tenant_id)
        if ap_tid != bill_tid:
            issues.append(
                _mk_issue(
                    category="billing_alignment",
                    detail="Bill tenant_id does not match appointment tenant_id",
                    resource_id=str(appt.id),
                    tenant_scope=bill_tid_s,
                )
            )

    ref_type = InventoryReferenceType.APPOINTMENT.value
    usage_stmt = (
        select(
            AppointmentInventoryUsage.appointment_id,
            AppointmentInventoryUsage.item_id,
            func.sum(AppointmentInventoryUsage.quantity),
        )
        .join(Appointment, Appointment.id == AppointmentInventoryUsage.appointment_id)
        .where(Appointment.is_deleted == False)
        .group_by(
            AppointmentInventoryUsage.appointment_id,
            AppointmentInventoryUsage.item_id,
        )
    )
    if appt_filter_tenant is not None:
        usage_stmt = usage_stmt.where(Appointment.tenant_id == appt_filter_tenant)

    usage_totals: dict[UUID, dict[UUID, int]] = defaultdict(dict)
    for ap_id, item_id, qty in db.execute(usage_stmt):
        usage_totals[ap_id][item_id] = int(qty or 0)

    mov_stmt = (
        select(
            InventoryMovement.reference_id,
            InventoryMovement.item_id,
            func.sum(InventoryMovement.quantity),
        )
        .join(Appointment, Appointment.id == InventoryMovement.reference_id)
        .where(
            Appointment.is_deleted == False,
            InventoryMovement.reference_id.isnot(None),
            InventoryMovement.type == InventoryMovementType.OUT,
            InventoryMovement.reference_type == ref_type,
        )
        .group_by(InventoryMovement.reference_id, InventoryMovement.item_id)
    )
    if appt_filter_tenant is not None:
        mov_stmt = mov_stmt.where(Appointment.tenant_id == appt_filter_tenant)

    mov_totals: dict[UUID, dict[UUID, int]] = defaultdict(dict)
    for ref_id, item_id, qty in db.execute(mov_stmt):
        if ref_id is None:
            continue
        mov_totals[ref_id][item_id] = int(qty or 0)

    appt_keys = set(usage_totals.keys()) | set(mov_totals.keys())
    for ap_id in sorted(appt_keys, key=lambda x: str(x)):
        umap = usage_totals.get(ap_id, {})
        mmap = mov_totals.get(ap_id, {})
        item_ids = set(umap.keys()) | set(mmap.keys())
        for item_id in sorted(item_ids, key=lambda x: str(x)):
            uqty = umap.get(item_id, 0)
            mqty = mmap.get(item_id, 0)
            if uqty != mqty:
                issues.append(
                    _mk_issue(
                        category="inventory_movement",
                        detail=(
                            f"Appointment inventory usage ({uqty}) does not match "
                            f"OUT movements ({mqty}) for item {item_id}"
                        ),
                        resource_id=str(ap_id),
                        tenant_scope=scoped_tid,
                    )
                )

    summary = _summarize_issues(issues, scanned_at=scanned_at)
    scope_key = _integrity_scope_key(all_tenants=all_tenants, tenant_id=tenant_id)
    prior_healthy = crud_integrity_scan_state.get_last_successful_scan_at(
        db, scope_key=scope_key
    )
    critical_count = int(summary["critical_count"])
    if critical_count == 0:
        crud_integrity_scan_state.upsert_last_successful_scan_at(
            db,
            scope_key=scope_key,
            scanned_at=scanned_at,
        )
        last_successful_scan_at = scanned_at
    else:
        last_successful_scan_at = prior_healthy
    return IntegrityScanResponse(
        scanned_at=scanned_at,
        tenant_id=str(tenant_id) if tenant_id is not None else None,
        all_tenants=all_tenants,
        appointments_checked=appointments_checked,
        issues=issues,
        last_successful_scan_at=last_successful_scan_at,
        **summary,
    )


def scan_system_invariants_cached(
    db: Session,
    *,
    tenant_id: UUID | None = None,
    all_tenants: bool = False,
    ttl_seconds: int | None = None,
) -> IntegrityScanResponse:
    """Optional short TTL cache keyed by tenant scope + all_tenants (process-local only)."""
    ttl = ttl_seconds if ttl_seconds is not None else int(settings.INTEGRITY_SCAN_CACHE_SECONDS)
    scope_key = _integrity_scope_key(all_tenants=all_tenants, tenant_id=tenant_id)
    if ttl <= 0:
        return scan_system_invariants(db, tenant_id=tenant_id, all_tenants=all_tenants)
    tenant_key = str(tenant_id) if tenant_id is not None else None
    cache_key = (all_tenants, tenant_key)
    now = time.time()
    with _CACHE_LOCK:
        hit = _SCAN_CACHE.get(cache_key)
        if hit is not None:
            expiry, cached = hit
            if expiry > now:
                stored = crud_integrity_scan_state.get_last_successful_scan_at(
                    db, scope_key=scope_key
                )
                return cached.model_copy(update={"last_successful_scan_at": stored})
        snapshot = scan_system_invariants(db, tenant_id=tenant_id, all_tenants=all_tenants)
        _SCAN_CACHE[cache_key] = (now + ttl, snapshot)
    return snapshot


def invalidate_integrity_scan_cache() -> None:
    """Clear process-local integrity scan snapshots (tests or administrative use)."""
    with _CACHE_LOCK:
        _SCAN_CACHE.clear()
