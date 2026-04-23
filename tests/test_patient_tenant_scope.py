"""Tenant admin listing and doctor appointment cohort for patients."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.data_scope import ResolvedDataScope, resolve_data_scope
from app.crud import crud_doctor
from app.crud.crud_appointment import add_appointment
from app.models.appointment import AppointmentStatus
from app.models.patient import Patient
from app.models.tenant import TenantType
from app.models.user import UserRole
from app.services import patient_service
from app.services.exceptions import ForbiddenError
from tests.factories import create_doctor_profile, create_patient_profile, create_tenant, create_user


def _data_scope_tenant(db: Session, user) -> ResolvedDataScope:
    linked = crud_doctor.get_doctor_by_user_id(db, user.id)
    return resolve_data_scope("tenant", current_user=user, linked_doctor=linked)


def _data_scope_doctor(db: Session, user) -> ResolvedDataScope:
    linked = crud_doctor.get_doctor_by_user_id(db, user.id)
    return resolve_data_scope("doctor", current_user=user, linked_doctor=linked)


def test_admin_sees_patient_with_null_tenant_id_via_appointment_fallback(
    db_session: Session,
) -> None:
    """NULL patient.tenant_id but appointment in tenant: admin and assigned doctor can list them."""
    tenant = create_tenant(db_session, tenant_type=TenantType.clinic)
    admin = create_user(
        db_session,
        email=f"adm_tnull_{uuid.uuid4().hex[:8]}@test.local",
        password="AdmPass123!",
        role=UserRole.admin,
        tenant_id=tenant.id,
    )
    doc_user = create_user(
        db_session,
        email=f"doc_tnull_{uuid.uuid4().hex[:8]}@test.local",
        password="DocPass123!",
        role=UserRole.doctor,
        tenant_id=tenant.id,
    )
    doc = create_doctor_profile(
        db_session, tenant_id=tenant.id, user_id=doc_user.id, timezone_name="UTC"
    )
    pat_user = create_user(
        db_session,
        email=f"pat_tnull_{uuid.uuid4().hex[:8]}@test.local",
        password="PatPass123!",
        role=UserRole.patient,
        tenant_id=tenant.id,
    )
    p = create_patient_profile(
        db_session,
        tenant_id=tenant.id,
        user_id=pat_user.id,
        created_by=doc_user.id,
    )
    db_session.commit()
    db_session.execute(
        update(Patient).where(Patient.id == p.id).values(tenant_id=None)
    )
    db_session.commit()

    add_appointment(
        db_session,
        {
            "patient_id": p.id,
            "doctor_id": doc.id,
            "appointment_time": datetime.now(timezone.utc) + timedelta(hours=2),
            "status": AppointmentStatus.scheduled,
            "created_by": doc_user.id,
            "tenant_id": tenant.id,
        },
    )
    db_session.commit()

    listed = {
        x.id
        for x in patient_service.get_patients(
            db_session,
            admin,
            tenant_id=tenant.id,
            limit=100,
            data_scope=_data_scope_tenant(db_session, admin),
        )
    }
    assert p.id in listed

    doc_listed = {
        x.id
        for x in patient_service.get_patients(
            db_session,
            doc_user,
            tenant_id=tenant.id,
            limit=100,
            data_scope=_data_scope_doctor(db_session, doc_user),
        )
    }
    assert p.id in doc_listed

    other = create_user(
        db_session,
        email=f"oth_{uuid.uuid4().hex[:8]}@test.local",
        password="DocPass123!",
        role=UserRole.doctor,
        tenant_id=tenant.id,
    )
    _ = create_doctor_profile(
        db_session, tenant_id=tenant.id, user_id=other.id, timezone_name="UTC"
    )
    db_session.commit()
    peer = {
        x.id
        for x in patient_service.get_patients(
            db_session,
            other,
            tenant_id=tenant.id,
            limit=100,
            data_scope=_data_scope_doctor(db_session, other),
        )
    }
    assert p.id not in peer


def test_doctor_read_requires_appointment_not_created_by(
    db_session: Session,
) -> None:
    """Doctor without an appointment to the patient is denied; creator-only is not enough."""
    tenant = create_tenant(db_session, tenant_type=TenantType.hospital)
    doc_a = create_user(
        db_session,
        email=f"dca_{uuid.uuid4().hex[:8]}@test.local",
        password="DocPass123!",
        role=UserRole.doctor,
        tenant_id=tenant.id,
    )
    d_a = create_doctor_profile(
        db_session, tenant_id=tenant.id, user_id=doc_a.id, timezone_name="UTC"
    )
    doc_b = create_user(
        db_session,
        email=f"dcb_{uuid.uuid4().hex[:8]}@test.local",
        password="DocPass123!",
        role=UserRole.doctor,
        tenant_id=tenant.id,
    )
    d_b = create_doctor_profile(
        db_session, tenant_id=tenant.id, user_id=doc_b.id, timezone_name="UTC"
    )
    pat_user = create_user(
        db_session,
        email=f"pu_{uuid.uuid4().hex[:8]}@test.local",
        password="PatPass123!",
        role=UserRole.patient,
        tenant_id=tenant.id,
    )
    patient = create_patient_profile(
        db_session,
        tenant_id=tenant.id,
        user_id=pat_user.id,
        created_by=doc_a.id,
    )
    add_appointment(
        db_session,
        {
            "patient_id": patient.id,
            "doctor_id": d_b.id,
            "appointment_time": datetime.now(timezone.utc) + timedelta(hours=3),
            "status": AppointmentStatus.scheduled,
            "created_by": pat_user.id,
            "tenant_id": tenant.id,
        },
    )
    db_session.commit()

    with pytest.raises(ForbiddenError, match="Not allowed to modify this patient"):
        patient_service.authorize_patient_read(
            db_session,
            patient,
            doc_a,
            tenant_id=tenant.id,
            acting_doctor=d_a,
        )
    patient_service.authorize_patient_read(
        db_session,
        patient,
        doc_b,
        tenant_id=tenant.id,
        acting_doctor=d_b,
    )
