from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.organization_display import organization_label_from_active_doctor_count
from app.models.doctor import Doctor
from app.models.doctor_profile import DoctorProfile
from app.models.tenant import Tenant
from app.schemas.public_discovery import PublicDoctorProfileRead, PublicTenantDiscoveryRead, PublicTenantDoctorBrief
from app.services import doctor_service
from app.services.exceptions import NotFoundError


def get_public_approved_doctor(db: Session, doctor_id: UUID) -> PublicDoctorProfileRead:
    """
    Public doctor card — only if structured profile is marketplace-approved.
    Inactive, deleted, or unverified doctors are not exposed (404).
    """
    stmt = (
        select(Doctor, DoctorProfile)
        .join(DoctorProfile, DoctorProfile.doctor_id == Doctor.id)
        .where(
            Doctor.id == doctor_id,
            Doctor.is_active == True,  # noqa: E712
            Doctor.is_deleted == False,  # noqa: E712
            DoctorProfile.verification_status == "approved",
        )
    )
    row = db.execute(stmt).first()
    if row is None:
        raise NotFoundError("Doctor not found")
    doctor, prof = row
    doctor_service.hydrate_doctor_availability_flags(db, [doctor])
    spec = (prof.specialization or "").strip() or doctor.specialization
    exp = prof.experience_years
    if exp is None:
        exp = doctor.experience_years
    return PublicDoctorProfileRead(
        id=doctor.id,
        full_name=prof.full_name,
        specialization=spec,
        experience=int(exp),
        qualification=prof.qualification,
        clinic_name=prof.clinic_name,
        address=prof.address,
        city=prof.city,
        profile_image=prof.profile_image,
        verified=True,
        verification_status="approved",
        timezone=doctor.timezone,
        has_availability_windows=bool(getattr(doctor, "has_availability_windows", False)),
    )


def list_public_tenants_for_discovery(db: Session) -> list[PublicTenantDiscoveryRead]:
    """
    Active tenants with at least one active, non-deleted doctor.
    For single-doctor tenants, ``sole_doctor`` is populated so the client can render without N+1 calls.
    """
    stmt = (
        select(
            Tenant.id,
            Tenant.name,
            Tenant.type,
            func.count(Doctor.id).label("doctor_count"),
        )
        .select_from(Tenant)
        .join(Doctor, Doctor.tenant_id == Tenant.id)
        .where(
            Tenant.is_active == True,  # noqa: E712
            Tenant.is_deleted == False,  # noqa: E712
            Doctor.is_active == True,  # noqa: E712
            Doctor.is_deleted == False,  # noqa: E712
        )
        .group_by(Tenant.id, Tenant.name, Tenant.type)
        .order_by(Tenant.name.asc())
    )
    rows = db.execute(stmt).all()

    solo_tenant_ids = [r.id for r in rows if int(r.doctor_count) == 1]
    sole_by_tenant: dict[UUID, Doctor] = {}
    if solo_tenant_ids:
        doc_stmt = (
            select(Doctor)
            .join(DoctorProfile, DoctorProfile.doctor_id == Doctor.id)
            .where(
                Doctor.tenant_id.in_(solo_tenant_ids),
                Doctor.is_active == True,  # noqa: E712
                Doctor.is_deleted == False,  # noqa: E712
                DoctorProfile.verification_status == "approved",
            )
            .order_by(Doctor.name.asc())
        )
        for d in db.scalars(doc_stmt).all():
            if d.tenant_id not in sole_by_tenant:
                sole_by_tenant[d.tenant_id] = d

    out: list[PublicTenantDiscoveryRead] = []
    for r in rows:
        dc = int(r.doctor_count)
        sole = None
        if dc == 1:
            doc = sole_by_tenant.get(r.id)
            if doc is not None:
                sole = PublicTenantDoctorBrief.model_validate(doc)
        out.append(
            PublicTenantDiscoveryRead(
                id=r.id,
                name=r.name,
                doctor_count=dc,
                type=str(r.type),
                organization_label=organization_label_from_active_doctor_count(dc),
                sole_doctor=sole,
            )
        )
    return out


def list_public_doctors_for_tenant(db: Session, tenant_id: UUID) -> list[PublicTenantDoctorBrief]:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None or not tenant.is_active or tenant.is_deleted:
        raise NotFoundError("Tenant not found")

    stmt = (
        select(Doctor)
        .join(DoctorProfile, DoctorProfile.doctor_id == Doctor.id)
        .where(
            Doctor.tenant_id == tenant_id,
            Doctor.is_active == True,  # noqa: E712
            Doctor.is_deleted == False,  # noqa: E712
            DoctorProfile.verification_status == "approved",
        )
        .order_by(Doctor.name.asc())
    )
    doctors = list(db.scalars(stmt).all())
    return [PublicTenantDoctorBrief.model_validate(d) for d in doctors]
