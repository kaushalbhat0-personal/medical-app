from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import crud_tenant
from app.schemas.tenant import TenantPublicRead

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("", response_model=list[TenantPublicRead])
def read_tenants(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[TenantPublicRead]:
    # Public listing: hospitals only (marketplace discovery)
    # NOTE: this endpoint is intentionally unauthenticated.
    return crud_tenant.list_tenants(db, type="hospital", is_active=True, skip=skip, limit=limit)

