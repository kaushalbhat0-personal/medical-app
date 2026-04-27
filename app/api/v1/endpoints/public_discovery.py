from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.public_discovery import PublicDoctorProfileRead, PublicTenantDiscoveryRead, PublicTenantDoctorBrief
from app.services import public_discovery_service

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/tenants", response_model=list[PublicTenantDiscoveryRead])
def list_public_tenants(db: Session = Depends(get_db)) -> list[PublicTenantDiscoveryRead]:
    return public_discovery_service.list_public_tenants_for_discovery(db)


@router.get("/tenants/{tenant_id}/doctors", response_model=list[PublicTenantDoctorBrief])
def list_public_tenant_doctors(
    tenant_id: UUID,
    db: Session = Depends(get_db),
) -> list[PublicTenantDoctorBrief]:
    return public_discovery_service.list_public_doctors_for_tenant(db, tenant_id)


@router.get("/doctors/{doctor_id}", response_model=PublicDoctorProfileRead)
def get_public_doctor(
    doctor_id: UUID,
    db: Session = Depends(get_db),
) -> PublicDoctorProfileRead:
    """Public profile for marketplace-verified doctors only; other IDs return 404."""
    return public_discovery_service.get_public_approved_doctor(db, doctor_id)
