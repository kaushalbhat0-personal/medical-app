from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_active_user,
    get_current_user,
    get_optional_scoped_tenant_id,
    get_optional_scoped_tenant_id_active,
    get_resolved_data_scope,
    require_structured_profile_complete,
)
from app.core.data_scope import ResolvedDataScope
from app.core.database import get_db
from app.models.inventory import InventoryItemType
from app.models.user import User
from app.schemas.inventory import (
    BulkStockRow,
    InventoryItemCreate,
    InventoryItemRead,
    InventoryItemUpdate,
    StockAddRequest,
    StockAdjustRequest,
    StockOperationResult,
    StockRead,
    StockReduceRequest,
)
from app.services import inventory_service

router = APIRouter(
    prefix="/inventory",
    tags=["inventory"],
    dependencies=[Depends(require_structured_profile_complete)],
)


@router.get("/stock/bulk", response_model=None)
def get_bulk_stock(
    doctor_id: UUID | None = Query(default=None, description="Doctor-scoped stock; omit for tenant level"),
    item_ids: list[UUID] | None = Query(
        default=None,
        description="If set, only these item IDs (must belong to the tenant scope)",
    ),
    as_map: bool = Query(
        default=False,
        description="If true, return a JSON object mapping item_id (string) to quantity",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID | None = Depends(get_optional_scoped_tenant_id),
    data_scope: ResolvedDataScope = Depends(get_resolved_data_scope),
) -> list[BulkStockRow] | dict[str, int]:
    rows = inventory_service.get_bulk_stock(
        tenant_id,
        doctor_id=doctor_id,
        item_ids=item_ids,
        db=db,
        current_user=current_user,
        data_scope=data_scope,
    )
    if as_map:
        return {str(iid): qty for iid, qty in rows}
    return [BulkStockRow(item_id=iid, quantity=qty) for iid, qty in rows]


@router.get("/stock", response_model=StockRead)
def get_one_stock(
    item_id: UUID = Query(..., description="Inventory item id"),
    doctor_id: UUID | None = Query(default=None, description="Doctor id for doctor-level stock; omit for tenant level"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID | None = Depends(get_optional_scoped_tenant_id),
    data_scope: ResolvedDataScope = Depends(get_resolved_data_scope),
) -> StockRead:
    quantity = inventory_service.get_stock(
        db,
        item_id,
        doctor_id=doctor_id,
        current_user=current_user,
        tenant_id=tenant_id,
        data_scope=data_scope,
    )
    return StockRead(item_id=item_id, doctor_id=doctor_id, quantity=quantity)


@router.post("/items", response_model=InventoryItemRead, status_code=201)
def create_inventory_item(
    payload: InventoryItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID | None = Depends(get_optional_scoped_tenant_id_active),
) -> InventoryItemRead:
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
    tenant_id: UUID | None = Depends(get_optional_scoped_tenant_id),
) -> list[InventoryItemRead]:
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
    tenant_id: UUID | None = Depends(get_optional_scoped_tenant_id_active),
) -> InventoryItemRead:
    item = inventory_service.update_item(db, item_id, payload, current_user, tenant_id)
    return InventoryItemRead.model_validate(item)


@router.post("/stock/add", response_model=StockOperationResult)
def stock_add(
    body: StockAddRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID | None = Depends(get_optional_scoped_tenant_id_active),
    data_scope: ResolvedDataScope = Depends(get_resolved_data_scope),
) -> StockOperationResult:
    movement_id, qty = inventory_service.add_stock(
        db, body, current_user, tenant_id, data_scope=data_scope
    )
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
    tenant_id: UUID | None = Depends(get_optional_scoped_tenant_id_active),
    data_scope: ResolvedDataScope = Depends(get_resolved_data_scope),
) -> StockOperationResult:
    movement_id, qty = inventory_service.reduce_stock(
        db, body, current_user, tenant_id, data_scope=data_scope
    )
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
    tenant_id: UUID | None = Depends(get_optional_scoped_tenant_id_active),
    data_scope: ResolvedDataScope = Depends(get_resolved_data_scope),
) -> StockOperationResult:
    movement_id, qty = inventory_service.adjust_stock(
        db, body, current_user, tenant_id, data_scope=data_scope
    )
    return StockOperationResult(
        item_id=body.item_id,
        doctor_id=body.doctor_id,
        quantity=qty,
        movement_id=movement_id,
    )
