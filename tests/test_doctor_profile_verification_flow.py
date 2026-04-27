"""Doctor marketplace verification: draft until explicit submit-for-verification."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.tenant import TenantType
from app.models.user import UserRole
from tests.factories import create_tenant, create_user

PROFILE = "/api/v1/doctor/profile"
SUBMIT = "/api/v1/doctor/profile/submit-for-verification"


async def _login(client: AsyncClient, email: str, password: str) -> str:
    r = await client.post(
        "/api/v1/login",
        data={"username": email, "password": password},
    )
    assert r.status_code == 200, r.text
    return str(r.json()["access_token"])


def _doctor_with_no_structured_profile(db: Session) -> tuple[Doctor, str, str]:
    """Roster doctor + user; no `doctor_profiles` row."""
    tenant = create_tenant(
        db, name=f"vflow-{uuid.uuid4().hex[:6]}", tenant_type=TenantType.organization
    )
    password = "DocPass9!!"
    user = create_user(
        db,
        email=f"doc_{uuid.uuid4().hex[:10]}@vflow.local",
        password=password,
        role=UserRole.doctor,
        tenant_id=tenant.id,
    )
    doc = Doctor(
        name="Dr Flow",
        specialization="General",
        experience_years=1,
        tenant_id=tenant.id,
        user_id=user.id,
        timezone="UTC",
    )
    db.add(doc)
    db.flush()
    return doc, user.email, password


@pytest.mark.asyncio
async def test_profile_create_and_update_stays_draft_submit_goes_pending(
    client: AsyncClient, db_session: Session
) -> None:
    _, email, password = _doctor_with_no_structured_profile(db_session)
    db_session.commit()

    tok = await _login(client, email, password)
    auth = {"Authorization": f"Bearer {tok}"}

    inc = {
        "full_name": "Dr Incomplete",
        "phone": "9000000001",
    }
    r = await client.post(PROFILE, headers=auth, json=inc)
    assert r.status_code == 200, r.text
    assert r.json()["verification_status"] == "draft"

    r2 = await client.put(
        PROFILE,
        headers=auth,
        json={**inc, "specialization": "  "},
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["verification_status"] == "draft"

    r3 = await client.post(SUBMIT, headers=auth)
    assert r3.status_code == 400, r3.text
    assert r3.json()["detail"] == "Profile incomplete"

    complete = {
        "full_name": "Dr Complete",
        "phone": "9000000002",
        "specialization": "Cardiology",
        "qualification": "MBBS",
        "registration_number": "REG-100",
        "registration_council": "Council",
        "clinic_name": "Clinic",
        "address": "1 St",
        "city": "City",
        "state": "State",
        "experience_years": 5,
    }
    r4 = await client.put(PROFILE, headers=auth, json=complete)
    assert r4.status_code == 200, r4.text
    assert r4.json()["verification_status"] == "draft"
    assert r4.json()["is_profile_complete"] is True

    r5 = await client.post(SUBMIT, headers=auth)
    assert r5.status_code == 200, r5.text
    assert r5.json()["verification_status"] == "pending"
    assert r5.json().get("verification_rejection_reason") is None
