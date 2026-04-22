"""RBAC: doctors are always scoped to a tenant; permissions use tenant_id, not tenant *type*."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy.orm import Session

from app.crud.crud_appointment import add_appointment
from app.models.appointment import AppointmentStatus
from app.models.tenant import Tenant, TenantType
from app.models.user import User, UserRole
from app.schemas.billing import BillingCreate
from app.services import billing_service, patient_service
from app.services.exceptions import ForbiddenError
from tests.factories import create_doctor_profile, create_patient_profile, create_user


def _tenant(db: Session, tenant_type: TenantType) -> Tenant:
    t = Tenant(name=f"T {uuid.uuid4().hex[:8]}", type=tenant_type.value)
    db.add(t)
    db.flush()
    return t


def _doctor_user_and_billing_for_tenant(
    db: Session, tenant: Tenant, email_prefix: str
) -> tuple[User, BillingCreate]:
    doc_user = create_user(
        db,
        email=f"{email_prefix}_{uuid.uuid4().hex[:8]}@test.local",
        password="DocPass123!",
        role=UserRole.doctor,
        tenant_id=tenant.id,
    )
    doctor = create_doctor_profile(db, tenant_id=tenant.id, user_id=doc_user.id)
    pat_user = create_user(
        db,
        email=f"{email_prefix}p_{uuid.uuid4().hex[:8]}@test.local",
        password="PatPass123!",
        role=UserRole.patient,
        tenant_id=tenant.id,
    )
    patient = create_patient_profile(
        db,
        tenant_id=tenant.id,
        user_id=pat_user.id,
        created_by=pat_user.id,
    )
    appt: Any = add_appointment(
        db,
        {
            "patient_id": patient.id,
            "doctor_id": doctor.id,
            "appointment_time": datetime.now(timezone.utc) + timedelta(hours=2),
            "status": AppointmentStatus.scheduled,
            "created_by": pat_user.id,
            "tenant_id": tenant.id,
        },
    )
    db.commit()
    billing_in = BillingCreate(
        patient_id=patient.id,
        appointment_id=appt.id,
        amount=Decimal("100.00"),
    )
    return doc_user, billing_in


def test_clinic_doctor_can_create_patient(db_session: Session) -> None:
    tenant = _tenant(db_session, TenantType.clinic)
    doc_user = create_user(
        db_session,
        email=f"clinicdoc_{uuid.uuid4().hex[:8]}@test.local",
        password="DocPass123!",
        role=UserRole.doctor,
        tenant_id=tenant.id,
    )
    create_doctor_profile(db_session, tenant_id=tenant.id, user_id=doc_user.id)
    db_session.commit()

    patient_service.authorize_patient_create(db_session, doc_user, tenant_id=tenant.id)


def test_hospital_doctor_sees_same_tenant_patient_without_personal_appointment(
    db_session: Session,
) -> None:
    """All doctors in a tenant may access patients with the same tenant_id."""
    tenant = _tenant(db_session, TenantType.hospital)
    doc_a_user = create_user(
        db_session,
        email=f"hos_a_{uuid.uuid4().hex[:8]}@test.local",
        password="DocPass123!",
        role=UserRole.doctor,
        tenant_id=tenant.id,
    )
    create_doctor_profile(db_session, tenant_id=tenant.id, user_id=doc_a_user.id)
    doc_b_user = create_user(
        db_session,
        email=f"hos_b_{uuid.uuid4().hex[:8]}@test.local",
        password="DocPass123!",
        role=UserRole.doctor,
        tenant_id=tenant.id,
    )
    doctor_b = create_doctor_profile(
        db_session, tenant_id=tenant.id, user_id=doc_b_user.id
    )
    pat_user = create_user(
        db_session,
        email=f"hosp_{uuid.uuid4().hex[:8]}@test.local",
        password="PatPass123!",
        role=UserRole.patient,
        tenant_id=tenant.id,
    )
    patient = create_patient_profile(
        db_session,
        tenant_id=tenant.id,
        user_id=pat_user.id,
        created_by=pat_user.id,
    )
    add_appointment(
        db_session,
        {
            "patient_id": patient.id,
            "doctor_id": doctor_b.id,
            "appointment_time": datetime.now(timezone.utc) + timedelta(hours=3),
            "status": AppointmentStatus.scheduled,
            "created_by": pat_user.id,
            "tenant_id": tenant.id,
        },
    )
    db_session.commit()

    patient_service.authorize_patient_read(
        db_session, patient, doc_a_user, tenant_id=tenant.id
    )

    listed = patient_service.get_patients(
        db_session, doc_a_user, tenant_id=tenant.id, limit=100
    )
    assert patient.id in {p.id for p in listed}


def test_doctor_cannot_access_patient_in_other_tenant(db_session: Session) -> None:
    tenant_a = _tenant(db_session, TenantType.hospital)
    tenant_b = _tenant(db_session, TenantType.hospital)
    doc_user = create_user(
        db_session,
        email=f"cross_a_{uuid.uuid4().hex[:8]}@test.local",
        password="DocPass123!",
        role=UserRole.doctor,
        tenant_id=tenant_a.id,
    )
    create_doctor_profile(db_session, tenant_id=tenant_a.id, user_id=doc_user.id)
    pat_user = create_user(
        db_session,
        email=f"cross_b_{uuid.uuid4().hex[:8]}@test.local",
        password="PatPass123!",
        role=UserRole.patient,
        tenant_id=tenant_b.id,
    )
    patient = create_patient_profile(
        db_session,
        tenant_id=tenant_b.id,
        user_id=pat_user.id,
        created_by=pat_user.id,
    )
    db_session.commit()

    with pytest.raises(ForbiddenError, match="Resource is not in your tenant"):
        patient_service.authorize_patient_read(
            db_session, patient, doc_user, tenant_id=tenant_a.id
        )


def test_hospital_doctor_can_create_patient(db_session: Session) -> None:
    tenant = _tenant(db_session, TenantType.hospital)
    doc_user = create_user(
        db_session,
        email=f"hosdoc_{uuid.uuid4().hex[:8]}@test.local",
        password="DocPass123!",
        role=UserRole.doctor,
        tenant_id=tenant.id,
    )
    create_doctor_profile(db_session, tenant_id=tenant.id, user_id=doc_user.id)
    db_session.commit()

    patient_service.authorize_patient_create(db_session, doc_user, tenant_id=tenant.id)


def test_hospital_doctor_can_create_bill(db_session: Session) -> None:
    tenant = _tenant(db_session, TenantType.hospital)
    doc_user, billing_in = _doctor_user_and_billing_for_tenant(
        db_session, tenant, "hb"
    )
    billing_service.authorize_bill_create(
        db_session, billing_in, doc_user, tenant_id=tenant.id
    )


def test_clinic_doctor_can_create_bill(db_session: Session) -> None:
    tenant = _tenant(db_session, TenantType.clinic)
    doc_user, billing_in = _doctor_user_and_billing_for_tenant(
        db_session, tenant, "cb"
    )
    billing_service.authorize_bill_create(
        db_session, billing_in, doc_user, tenant_id=tenant.id
    )


def test_doctor_without_profile_cannot_create_patient(db_session: Session) -> None:
    tenant = _tenant(db_session, TenantType.clinic)
    doc_user = create_user(
        db_session,
        email=f"nodoc_{uuid.uuid4().hex[:8]}@test.local",
        password="DocPass123!",
        role=UserRole.doctor,
        tenant_id=tenant.id,
    )
    db_session.commit()

    with pytest.raises(ForbiddenError, match="Doctor profile not found for this user"):
        patient_service.authorize_patient_create(db_session, doc_user, tenant_id=tenant.id)


def test_doctor_without_profile_cannot_create_bill(db_session: Session) -> None:
    tenant = _tenant(db_session, TenantType.clinic)
    doc_user_no_profile = create_user(
        db_session,
        email=f"nodocb_{uuid.uuid4().hex[:8]}@test.local",
        password="DocPass123!",
        role=UserRole.doctor,
        tenant_id=tenant.id,
    )
    other_doc_user = create_user(
        db_session,
        email=f"otherdoc_{uuid.uuid4().hex[:8]}@test.local",
        password="DocPass123!",
        role=UserRole.doctor,
        tenant_id=tenant.id,
    )
    doctor = create_doctor_profile(
        db_session, tenant_id=tenant.id, user_id=other_doc_user.id
    )
    pat_user = create_user(
        db_session,
        email=f"nodocbp_{uuid.uuid4().hex[:8]}@test.local",
        password="PatPass123!",
        role=UserRole.patient,
        tenant_id=tenant.id,
    )
    patient = create_patient_profile(
        db_session,
        tenant_id=tenant.id,
        user_id=pat_user.id,
        created_by=pat_user.id,
    )
    appt: Any = add_appointment(
        db_session,
        {
            "patient_id": patient.id,
            "doctor_id": doctor.id,
            "appointment_time": datetime.now(timezone.utc) + timedelta(hours=2),
            "status": AppointmentStatus.scheduled,
            "created_by": pat_user.id,
            "tenant_id": tenant.id,
        },
    )
    db_session.commit()
    billing_in = BillingCreate(
        patient_id=patient.id,
        appointment_id=appt.id,
        amount=Decimal("100.00"),
    )

    with pytest.raises(ForbiddenError, match="Doctor profile not found for this user"):
        billing_service.authorize_bill_create(
            db_session, billing_in, doc_user_no_profile, tenant_id=tenant.id
        )
