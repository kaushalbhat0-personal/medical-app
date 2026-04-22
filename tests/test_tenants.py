"""Tenant API: hospital creation with admin user and user_tenant mapping."""

from __future__ import annotations

import uuid
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.tenant import Tenant, UserTenant
from app.models.user import User, UserRole
from tests.factories import create_tenant, create_user


@pytest.mark.asyncio
async def test_create_hospital_creates_admin_user_and_mapping(
    client: AsyncClient, db_session: Session
) -> None:
    db = db_session
    home = create_tenant(db, name="super home")
    super_email = f"sa_{uuid.uuid4().hex[:8]}@example.com"
    create_user(
        db,
        email=super_email,
        password="SuperAdmin9!",
        role=UserRole.super_admin,
        tenant_id=home.id,
    )
    db.commit()

    login = await client.post(
        "/api/v1/login",
        data={"username": super_email, "password": "SuperAdmin9!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    suffix = uuid.uuid4().hex[:8]
    admin_email_mixed = f"Admin.{suffix}@Hospital.ORG"
    expected_email = admin_email_mixed.lower().strip()
    hospital_name = f"Test Hospital {suffix}"

    resp = await client.post(
        "/api/v1/tenants",
        json={
            "name": hospital_name,
            "type": "hospital",
            "admin": {"email": admin_email_mixed, "password": "Hospital9!"},
            "phone": "  +1 555 0100  ",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["name"] == hospital_name
    assert data["type"] == "hospital"
    assert data["admin_email"] == expected_email
    assert data["phone"] == "+1 555 0100"

    tid = UUID(data["id"])
    tenant = db.get(Tenant, tid)
    assert tenant is not None
    assert tenant.name == hospital_name

    user = db.scalars(select(User).where(User.email == expected_email)).one()
    assert user.role == UserRole.admin
    assert user.force_password_reset is True

    ut = db.scalars(
        select(UserTenant).where(
            UserTenant.user_id == user.id,
            UserTenant.tenant_id == tid,
        )
    ).one()
    assert ut.role == "admin"
    assert ut.is_primary is True


@pytest.mark.asyncio
async def test_create_hospital_duplicate_name_race(
    client: AsyncClient, db_session: Session
) -> None:
    """
    Only one tenant for a case-insensitively duplicate name. Concurrent POSTs
    are serialized by the unique index; this suite uses a shared in-memory
    SQLite connection, so we assert the same rule with two sequential requests
    (true parallel e2e is best validated against PostgreSQL).
    """
    db = db_session
    home = create_tenant(db, name="super home race")
    super_email = f"sa_race_{uuid.uuid4().hex[:8]}@example.com"
    create_user(
        db,
        email=super_email,
        password="SuperAdmin9!",
        role=UserRole.super_admin,
        tenant_id=home.id,
    )
    db.commit()

    login = await client.post(
        "/api/v1/login",
        data={"username": super_email, "password": "SuperAdmin9!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    suffix = uuid.uuid4().hex[:8]
    hospital_name = f"Race Hospital {suffix}"
    body_a = {
        "name": hospital_name,
        "type": "hospital",
        "admin": {"email": f"admin_race_a_{suffix}@example.com", "password": "Hospital9!"},
    }
    body_b = {
        "name": hospital_name,
        "type": "hospital",
        "admin": {"email": f"admin_race_b_{suffix}@example.com", "password": "Hospital9!"},
    }
    auth = {"Authorization": f"Bearer {token}"}

    r_ok = await client.post("/api/v1/tenants", json=body_a, headers=auth)
    assert r_ok.status_code == 201
    r_dup = await client.post("/api/v1/tenants", json=body_b, headers=auth)
    assert r_dup.status_code == 400
    assert "name" in r_dup.json()["detail"].lower() or "tenant" in r_dup.json()["detail"].lower()

    count = db.scalar(
        select(func.count(Tenant.id)).where(func.lower(Tenant.name) == hospital_name.lower())
    )
    assert count == 1


@pytest.mark.asyncio
async def test_create_hospital_idempotency_key_returns_same_tenant(
    client: AsyncClient, db_session: Session
) -> None:
    db = db_session
    home = create_tenant(db, name="super home idem")
    super_email = f"sa_idem_{uuid.uuid4().hex[:8]}@example.com"
    create_user(
        db,
        email=super_email,
        password="SuperAdmin9!",
        role=UserRole.super_admin,
        tenant_id=home.id,
    )
    db.commit()

    login = await client.post(
        "/api/v1/login",
        data={"username": super_email, "password": "SuperAdmin9!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    suffix = uuid.uuid4().hex[:8]
    hospital_name = f"Idem Hospital {suffix}"
    admin_email = f"admin_idem_{suffix}@example.com"
    body = {
        "name": hospital_name,
        "type": "hospital",
        "admin": {"email": admin_email, "password": "Hospital9!"},
    }
    key = f"idem-{suffix}"
    headers = {"Authorization": f"Bearer {token}", "Idempotency-Key": key}

    r1 = await client.post("/api/v1/tenants", json=body, headers=headers)
    r2 = await client.post("/api/v1/tenants", json=body, headers=headers)
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["id"] == r2.json()["id"]
    assert r1.json()["admin_email"] == r2.json()["admin_email"]
