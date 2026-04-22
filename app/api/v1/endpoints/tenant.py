from fastapi import APIRouter, Depends, Header, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.crud import crud_tenant
from app.models.user import User
from app.schemas.tenant import TenantCreate, TenantPublicRead
from app.services import tenant_service

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.post(
    "",
    response_model=TenantPublicRead,
    status_code=status.HTTP_201_CREATED,
)
def create_tenant(
    payload: TenantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
) -> TenantPublicRead:
    tenant, admin_email = tenant_service.create_hospital_tenant(
        db, payload, current_user, idempotency_key=idempotency_key
    )
    return TenantPublicRead.model_validate(tenant).model_copy(update={"admin_email": admin_email})


@router.get("", response_model=list[TenantPublicRead])
def read_tenants(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[TenantPublicRead]:
    # Public listing: hospitals only (marketplace discovery)
    # NOTE: this endpoint is intentionally unauthenticated.
    return crud_tenant.list_tenants(db, type="hospital", is_active=True, skip=skip, limit=limit)

