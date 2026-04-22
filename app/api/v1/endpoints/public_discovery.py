from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.public_discovery import PublicTenantDiscoveryRead, PublicTenantDoctorBrief
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
