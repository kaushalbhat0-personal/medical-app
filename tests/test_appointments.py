"""Appointment API: slot double-book conflict."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from app.models.user import UserRole
from tests.factories import create_patient_profile, create_user, seed_bookable_doctor_and_patient


@pytest.mark.asyncio
async def test_slot_conflict_second_booking_rejected(
    client: AsyncClient, db_session: Session
) -> None:
    doc_email = f"doc_{uuid.uuid4().hex[:8]}@e2e.test"
    pat_email = f"pat_{uuid.uuid4().hex[:8]}@e2e.test"
    doc_pw = "DocPass123!"
    pat_pw = "PatPass123!"

    doctor, patient, slot = seed_bookable_doctor_and_patient(
        db_session,
        doctor_email=doc_email,
        doctor_password=doc_pw,
        patient_email=pat_email,
        patient_password=pat_pw,
    )
    doctor_id = str(doctor.id)
    patient_id = str(patient.id)

    login = await client.post(
        "/api/v1/login",
        data={"username": pat_email, "password": pat_pw},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "appointment_time": slot.isoformat(),
    }

    first = await client.post("/api/v1/appointments", json=payload, headers=headers)
    assert first.status_code == 201, first.text

    second = await client.post("/api/v1/appointments", json=payload, headers=headers)
    assert second.status_code == 400
    detail = (second.json().get("detail") or "").lower()
    # Same instant is rejected before exact-slot dedupe (30-minute doctor buffer) in create flow.
    assert "slot already booked" in detail or "30 minutes" in detail or "appointment within" in detail


@pytest.mark.asyncio
async def test_slot_conflict_second_patient_same_slot_rejected(
    client: AsyncClient, db_session: Session
) -> None:
    doc_email = f"doc_{uuid.uuid4().hex[:8]}@e2e.test"
    pat_a_email = f"pata_{uuid.uuid4().hex[:8]}@e2e.test"
    pat_b_email = f"patb_{uuid.uuid4().hex[:8]}@e2e.test"
    doc_pw = "DocPass123!"
    pat_pw = "PatPass123!"

    doctor, patient_a, slot = seed_bookable_doctor_and_patient(
        db_session,
        doctor_email=doc_email,
        doctor_password=doc_pw,
        patient_email=pat_a_email,
        patient_password=pat_pw,
    )
    tenant_id = doctor.tenant_id
    assert tenant_id is not None

    pat_b_user = create_user(
        db_session,
        email=pat_b_email,
        password=pat_pw,
        role=UserRole.patient,
        tenant_id=tenant_id,
    )
    patient_b = create_patient_profile(
        db_session,
        tenant_id=tenant_id,
        user_id=pat_b_user.id,
        created_by=pat_b_user.id,
        name="Other Patient",
    )
    db_session.commit()

    login_a = await client.post(
        "/api/v1/login",
        data={"username": pat_a_email, "password": pat_pw},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_a.status_code == 200
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    login_b = await client.post(
        "/api/v1/login",
        data={"username": pat_b_email, "password": pat_pw},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_b.status_code == 200
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    payload_a = {
        "patient_id": str(patient_a.id),
        "doctor_id": str(doctor.id),
        "appointment_time": slot.isoformat(),
    }
    first = await client.post("/api/v1/appointments", json=payload_a, headers=headers_a)
    assert first.status_code == 201, first.text

    payload_b = {
        "patient_id": str(patient_b.id),
        "doctor_id": str(doctor.id),
        "appointment_time": slot.isoformat(),
    }
    second = await client.post("/api/v1/appointments", json=payload_b, headers=headers_b)
    assert second.status_code == 400
    detail = (second.json().get("detail") or "").lower()
    assert "slot already booked" in detail or "30 minutes" in detail or "appointment within" in detail
