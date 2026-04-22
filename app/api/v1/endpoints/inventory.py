from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_user
from app.core.database import get_db
from app.core.tenant_context import get_current_tenant_id
from app.models.inventory import InventoryItemType
from app.models.user import User
from app.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemRead,
    InventoryItemUpdate,
    StockAddRequest,
    StockAdjustRequest,
    StockOperationResult,
    StockReduceRequest,
)
from app.services import inventory_service

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.post("/items", response_model=InventoryItemRead, status_code=201)
def create_inventory_item(
    payload: InventoryItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> InventoryItemRead:
    tenant_id = get_current_tenant_id(current_user, db)
    item = inventory_service.create_item(db, payload, current_user, tenant_id)
    return InventoryItemRead.model_validate(item)


@router.get("/items", response_model=list[InventoryItemRead])
def list_inventory_items(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    item_type: InventoryItemType | None = Query(default=None, alias="type"),
    active_only: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[InventoryItemRead]:
    tenant_id = get_current_tenant_id(current_user, db)
    items = inventory_service.list_items(
        db,
        current_user,
        tenant_id,
        skip=skip,
        limit=limit,
        type_filter=item_type,
        active_only=active_only,
    )
    return [InventoryItemRead.model_validate(i) for i in items]


@router.put("/items/{item_id}", response_model=InventoryItemRead)
def update_inventory_item(
    item_id: UUID,
    payload: InventoryItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> InventoryItemRead:
    tenant_id = get_current_tenant_id(current_user, db)
    item = inventory_service.update_item(db, item_id, payload, current_user, tenant_id)
    return InventoryItemRead.model_validate(item)


@router.post("/stock/add", response_model=StockOperationResult)
def stock_add(
    body: StockAddRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StockOperationResult:
    tenant_id = get_current_tenant_id(current_user, db)
    movement_id, qty = inventory_service.add_stock(db, body, current_user, tenant_id)
    return StockOperationResult(
        item_id=body.item_id,
        doctor_id=body.doctor_id,
        quantity=qty,
        movement_id=movement_id,
    )


@router.post("/stock/reduce", response_model=StockOperationResult)
def stock_reduce(
    body: StockReduceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StockOperationResult:
    tenant_id = get_current_tenant_id(current_user, db)
    movement_id, qty = inventory_service.reduce_stock(db, body, current_user, tenant_id)
    return StockOperationResult(
        item_id=body.item_id,
        doctor_id=body.doctor_id,
        quantity=qty,
        movement_id=movement_id,
    )


@router.post("/stock/adjust", response_model=StockOperationResult)
def stock_adjust(
    body: StockAdjustRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StockOperationResult:
    tenant_id = get_current_tenant_id(current_user, db)
    movement_id, qty = inventory_service.adjust_stock(db, body, current_user, tenant_id)
    return StockOperationResult(
        item_id=body.item_id,
        doctor_id=body.doctor_id,
        quantity=qty,
        movement_id=movement_id,
    )
