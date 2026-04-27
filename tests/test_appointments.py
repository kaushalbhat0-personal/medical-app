"""Appointment API: slot double-book conflict."""

from __future__ import annotations

import uuid
from datetime import date, time

import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from app.models.user import UserRole
from tests.factories import (
    BOOKING_ANCHOR_DATE_ISO,
    add_weekly_availability,
    create_doctor_profile,
    create_patient_profile,
    create_user,
    seed_bookable_doctor_and_patient,
)


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


@pytest.mark.asyncio
async def test_patient_cannot_book_two_doctors_same_instant(
    client: AsyncClient, db_session: Session
) -> None:
    doc_a_email = f"doca_{uuid.uuid4().hex[:8]}@e2e.test"
    doc_b_email = f"docb_{uuid.uuid4().hex[:8]}@e2e.test"
    pat_email = f"pat_{uuid.uuid4().hex[:8]}@e2e.test"
    doc_pw = "DocPass123!"
    pat_pw = "PatPass123!"

    doctor_a, patient, slot = seed_bookable_doctor_and_patient(
        db_session,
        doctor_email=doc_a_email,
        doctor_password=doc_pw,
        patient_email=pat_email,
        patient_password=pat_pw,
    )
    tenant_id = doctor_a.tenant_id
    assert tenant_id is not None

    doc_b_user = create_user(
        db_session,
        email=doc_b_email,
        password=doc_pw,
        role=UserRole.doctor,
        tenant_id=tenant_id,
    )
    doctor_b = create_doctor_profile(
        db_session,
        tenant_id=tenant_id,
        user_id=doc_b_user.id,
        timezone_name="Asia/Kolkata",
    )
    anchor = date.fromisoformat(BOOKING_ANCHOR_DATE_ISO)
    add_weekly_availability(
        db_session,
        doctor_id=doctor_b.id,
        tenant_id=tenant_id,
        day_of_week=anchor.weekday(),
        start=time(10, 0),
        end=time(12, 0),
        slot_duration=30,
    )
    db_session.commit()

    login = await client.post(
        "/api/v1/login",
        data={"username": pat_email, "password": pat_pw},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    first = await client.post(
        "/api/v1/appointments",
        json={
            "patient_id": str(patient.id),
            "doctor_id": str(doctor_a.id),
            "appointment_time": slot.isoformat(),
        },
        headers=headers,
    )
    assert first.status_code == 201, first.text

    second = await client.post(
        "/api/v1/appointments",
        json={
            "patient_id": str(patient.id),
            "doctor_id": str(doctor_b.id),
            "appointment_time": slot.isoformat(),
        },
        headers=headers,
    )
    assert second.status_code == 400
    assert "already have an appointment at this time" in (second.json().get("detail") or "").lower()


@pytest.mark.asyncio
async def test_get_appointments_includes_doctor_timezone(
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

    login = await client.post(
        "/api/v1/login",
        data={"username": pat_email, "password": pat_pw},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "patient_id": str(patient.id),
        "doctor_id": str(doctor.id),
        "appointment_time": slot.isoformat(),
    }
    created = await client.post("/api/v1/appointments", json=payload, headers=headers)
    assert created.status_code == 201, created.text
    appt_id = created.json()["id"]

    listed = await client.get("/api/v1/appointments", headers=headers)
    assert listed.status_code == 200
    rows = listed.json()
    match = next((r for r in rows if r["id"] == appt_id), None)
    assert match is not None
    doc_out = match["doctor"]
    assert doc_out["id"] == str(doctor.id)
    assert doc_out["name"] == doctor.name
    assert doc_out["timezone"] == doctor.timezone

    assert created.json()["doctor"]["timezone"] == doctor.timezone


@pytest.mark.asyncio
async def test_get_appointments_type_past_and_upcoming(
    client: AsyncClient, db_session: Session
) -> None:
    """GET ?type=past returns completed (and cancelled); ?type=upcoming returns scheduled only."""
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

    login_pat = await client.post(
        "/api/v1/login",
        data={"username": pat_email, "password": pat_pw},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_pat.status_code == 200
    pat_headers = {"Authorization": f"Bearer {login_pat.json()['access_token']}"}
    create_payload = {
        "patient_id": str(patient.id),
        "doctor_id": str(doctor.id),
        "appointment_time": slot.isoformat(),
    }
    created = await client.post(
        "/api/v1/appointments", json=create_payload, headers=pat_headers
    )
    assert created.status_code == 201, created.text
    appt_id = created.json()["id"]

    doc_login = await client.post(
        "/api/v1/login",
        data={"username": doc_email, "password": doc_pw},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert doc_login.status_code == 200
    doc_headers = {"Authorization": f"Bearer {doc_login.json()['access_token']}"}

    up = await client.get(
        "/api/v1/appointments", params={"type": "upcoming", "limit": 100}, headers=doc_headers
    )
    assert up.status_code == 200
    assert appt_id in {r["id"] for r in up.json()}

    pa = await client.get(
        "/api/v1/appointments", params={"type": "past", "limit": 100}, headers=doc_headers
    )
    assert pa.status_code == 200
    assert appt_id not in {r["id"] for r in pa.json()}

    done = await client.put(
        f"/api/v1/appointments/{appt_id}", json={"status": "completed"}, headers=doc_headers
    )
    assert done.status_code == 200, done.text

    up2 = await client.get(
        "/api/v1/appointments", params={"type": "upcoming", "limit": 100}, headers=doc_headers
    )
    assert up2.status_code == 200
    assert appt_id not in {r["id"] for r in up2.json()}

    past2 = await client.get(
        "/api/v1/appointments", params={"type": "past", "limit": 100}, headers=doc_headers
    )
    assert past2.status_code == 200
    row = next((r for r in past2.json() if r["id"] == appt_id), None)
    assert row is not None
    assert row["status"] == "completed"
