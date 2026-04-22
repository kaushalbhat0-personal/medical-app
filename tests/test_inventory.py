"""Inventory API: tenant scope, stock via movements, non-negative stock."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from app.models.user import UserRole
from tests.factories import create_doctor_profile, create_tenant, create_user


@pytest.mark.asyncio
async def test_inventory_crud_and_stock_movements(
    client: AsyncClient, db_session: Session
) -> None:
    db = db_session
    tenant = create_tenant(db, name="inv-tenant-a")
    email = f"inv_admin_{uuid.uuid4().hex[:8]}@example.com"
    create_user(
        db,
        email=email,
        password="InvPass9!",
        role=UserRole.admin,
        tenant_id=tenant.id,
    )
    db.commit()

    login = await client.post(
        "/api/v1/login",
        data={"username": email, "password": "InvPass9!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    create_resp = await client.post(
        "/api/v1/inventory/items",
        json={
            "name": "Paracetamol 500mg",
            "type": "medicine",
            "unit": "strip",
            "cost_price": 20.0,
            "selling_price": 35.0,
            "is_active": True,
        },
        headers=auth,
    )
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]
    assert create_resp.json()["tenant_id"] == str(tenant.id)

    list_resp = await client.get("/api/v1/inventory/items", headers=auth)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    add_resp = await client.post(
        "/api/v1/inventory/stock/add",
        json={"item_id": item_id, "quantity": 100, "doctor_id": None},
        headers=auth,
    )
    assert add_resp.status_code == 200
    assert add_resp.json()["quantity"] == 100

    reduce_resp = await client.post(
        "/api/v1/inventory/stock/reduce",
        json={"item_id": item_id, "quantity": 30, "doctor_id": None},
        headers=auth,
    )
    assert reduce_resp.status_code == 200
    assert reduce_resp.json()["quantity"] == 70

    adj_resp = await client.post(
        "/api/v1/inventory/stock/adjust",
        json={"item_id": item_id, "quantity": -10, "doctor_id": None},
        headers=auth,
    )
    assert adj_resp.status_code == 200
    assert adj_resp.json()["quantity"] == 60

    bad = await client.post(
        "/api/v1/inventory/stock/reduce",
        json={"item_id": item_id, "quantity": 999, "doctor_id": None},
        headers=auth,
    )
    assert bad.status_code == 400
    assert "negative" in bad.json()["detail"].lower()


@pytest.mark.asyncio
async def test_inventory_doctor_scoped_stock(
    client: AsyncClient, db_session: Session
) -> None:
    db = db_session
    tenant = create_tenant(db, name="inv-tenant-doc")
    doc_email = f"inv_doc_{uuid.uuid4().hex[:8]}@example.com"
    doc_user = create_user(
        db,
        email=doc_email,
        password="InvPass9!",
        role=UserRole.doctor,
        tenant_id=tenant.id,
    )
    doctor = create_doctor_profile(db, tenant_id=tenant.id, user_id=doc_user.id)
    db.commit()

    login = await client.post(
        "/api/v1/login",
        data={"username": doc_email, "password": "InvPass9!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    create_resp = await client.post(
        "/api/v1/inventory/items",
        json={
            "name": "Gloves",
            "type": "consumable",
            "unit": "box",
            "cost_price": 200.0,
            "selling_price": 280.0,
        },
        headers=auth,
    )
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]

    add_doc = await client.post(
        "/api/v1/inventory/stock/add",
        json={"item_id": item_id, "quantity": 5, "doctor_id": str(doctor.id)},
        headers=auth,
    )
    assert add_doc.status_code == 200
    assert add_doc.json()["quantity"] == 5

    add_global = await client.post(
        "/api/v1/inventory/stock/add",
        json={"item_id": item_id, "quantity": 12, "doctor_id": None},
        headers=auth,
    )
    assert add_global.status_code == 200
    assert add_global.json()["quantity"] == 12


@pytest.mark.asyncio
async def test_inventory_cross_tenant_forbidden(
    client: AsyncClient, db_session: Session
) -> None:
    db = db_session
    ta = create_tenant(db, name="inv-ta")
    tb = create_tenant(db, name="inv-tb")
    email_a = f"inv_a_{uuid.uuid4().hex[:8]}@example.com"
    create_user(
        db,
        email=email_a,
        password="InvPass9!",
        role=UserRole.admin,
        tenant_id=ta.id,
    )
    email_b = f"inv_b_{uuid.uuid4().hex[:8]}@example.com"
    create_user(
        db,
        email=email_b,
        password="InvPass9!",
        role=UserRole.admin,
        tenant_id=tb.id,
    )
    db.commit()

    login_b = await client.post(
        "/api/v1/login",
        data={"username": email_b, "password": "InvPass9!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token_b = login_b.json()["access_token"]
    auth_b = {"Authorization": f"Bearer {token_b}"}

    item_b = await client.post(
        "/api/v1/inventory/items",
        json={
            "name": "Tenant B only",
            "type": "consumable",
            "unit": "each",
            "cost_price": 1.0,
            "selling_price": 2.0,
        },
        headers=auth_b,
    )
    item_id = item_b.json()["id"]

    login_a = await client.post(
        "/api/v1/login",
        data={"username": email_a, "password": "InvPass9!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token_a = login_a.json()["access_token"]
    auth_a = {"Authorization": f"Bearer {token_a}"}

    blocked = await client.post(
        "/api/v1/inventory/stock/add",
        json={"item_id": item_id, "quantity": 1, "doctor_id": None},
        headers=auth_a,
    )
    assert blocked.status_code == 403


@pytest.mark.asyncio
async def test_inventory_patient_forbidden(
    client: AsyncClient, db_session: Session
) -> None:
    db = db_session
    tenant = create_tenant(db, name="inv-pat")
    pat_email = f"inv_pat_{uuid.uuid4().hex[:8]}@example.com"
    create_user(
        db,
        email=pat_email,
        password="InvPass9!",
        role=UserRole.patient,
        tenant_id=tenant.id,
    )
    db.commit()

    login = await client.post(
        "/api/v1/login",
        data={"username": pat_email, "password": "InvPass9!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login.status_code == 200
    auth = {"Authorization": f"Bearer {login.json()['access_token']}"}

    resp = await client.get("/api/v1/inventory/items", headers=auth)
    assert resp.status_code == 403
