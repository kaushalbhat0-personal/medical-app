import logging
from uuid import UUID

from sqlalchemy import Select, and_, func, select
from sqlalchemy.orm import Session

from app.models.billing import Billing
from app.models.doctor import Doctor
from app.models.inventory import (
    InventoryItem,
    InventoryItemType,
    InventoryMovement,
    InventoryMovementType,
    InventoryStock,
)
from app.models.user import User, UserRole
from app.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemUpdate,
    StockAddRequest,
    StockAdjustRequest,
    StockReduceRequest,
)
from app.services.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.services.security_audit import assert_authorized, log_rbac_mutation_violation

logger = logging.getLogger(__name__)


def _forbid_patients(current_user: User, action: str = "inventory") -> None:
    if current_user.role == UserRole.patient:
        log_rbac_mutation_violation(current_user, action)
        raise ForbiddenError("Patients cannot access inventory")


def _authorize_item_tenant(
    item: InventoryItem,
    current_user: User,
    tenant_id: UUID | None,
) -> None:
    if tenant_id is None:
        raise ValidationError("X-Tenant-ID header is required")
    if current_user.role == UserRole.super_admin:
        if item.tenant_id != tenant_id:
            raise ForbiddenError("Item is not in the selected organization")
        return
    assert_authorized(
        "access",
        "inventory",
        current_user,
        tenant_id,
        resource_tenant_id=item.tenant_id,
    )


def _resolve_item_tenant_for_create(request_tenant_id: UUID | None) -> UUID:
    if request_tenant_id is None:
        raise ValidationError("X-Tenant-ID header is required")
    return request_tenant_id


def get_item_or_404(db: Session, item_id: UUID) -> InventoryItem:
    item = db.get(InventoryItem, item_id)
    if item is None:
        raise NotFoundError("Inventory item not found")
    return item


def get_stock(
    db: Session,
    item_id: UUID,
    doctor_id: UUID | None = None,
    *,
    current_user: User,
    tenant_id: UUID | None,
) -> int:
    """
    Read current quantity for one item and doctor scope (tenant level if doctor_id is None).
    If no row exists in inventory_stock, returns 0.
    """
    _forbid_patients(current_user)
    item = get_item_or_404(db, item_id)
    _authorize_item_tenant(item, current_user, tenant_id)
    _validate_doctor_for_item_tenant(db, doctor_id, item.tenant_id)
    row = db.scalars(_stock_query(item_id, doctor_id)).first()
    return int(row.quantity) if row is not None else 0


def get_bulk_stock(
    tenant_id: UUID | None,
    doctor_id: UUID | None = None,
    item_ids: list[UUID] | None = None,
    *,
    db: Session,
    current_user: User,
) -> list[tuple[UUID, int]]:
    """
    One-query stock for all items in the tenant (optionally doctor-scoped).
    Items without a stock row get quantity 0.
    """
    _forbid_patients(current_user)
    filter_tenant: UUID | None = tenant_id
    if doctor_id is not None:
        doctor = db.get(Doctor, doctor_id)
        if doctor is None:
            raise NotFoundError("Doctor not found")
        if tenant_id is not None and doctor.tenant_id != tenant_id:
            raise ValidationError("Doctor does not belong to the current tenant")
        filter_tenant = doctor.tenant_id
    else:
        if tenant_id is None:
            raise ValidationError("X-Tenant-ID header is required")
        filter_tenant = tenant_id

    join_cond = and_(
        InventoryStock.item_id == InventoryItem.id,
        (
            InventoryStock.doctor_id.is_(None)
            if doctor_id is None
            else InventoryStock.doctor_id == doctor_id
        ),
    )
    q = select(InventoryItem.id, func.coalesce(InventoryStock.quantity, 0)).outerjoin(
        InventoryStock,
        join_cond,
    )
    q = q.where(InventoryItem.tenant_id == filter_tenant)
    if item_ids is not None and len(item_ids) > 0:
        q = q.where(InventoryItem.id.in_(item_ids))
    q = q.order_by(InventoryItem.name.asc())
    return [(r[0], int(r[1])) for r in db.execute(q).all()]


def _validate_doctor_for_item_tenant(
    db: Session,
    doctor_id: UUID | None,
    item_tenant_id: UUID,
) -> None:
    if doctor_id is None:
        return
    doctor = db.get(Doctor, doctor_id)
    if doctor is None:
        raise NotFoundError("Doctor not found")
    if doctor.tenant_id != item_tenant_id:
        raise ValidationError("Doctor does not belong to the same tenant as this item")


def _validate_billing_reference(
    db: Session,
    billing_id: UUID | None,
    item_tenant_id: UUID,
) -> None:
    if billing_id is None:
        return
    bill = db.get(Billing, billing_id)
    if bill is None:
        raise NotFoundError("Billing record not found")
    if bill.tenant_id is not None and bill.tenant_id != item_tenant_id:
        raise ValidationError("Billing record belongs to a different tenant")


def _stock_query(item_id: UUID, doctor_id: UUID | None) -> Select[tuple[InventoryStock]]:
    q = select(InventoryStock).where(InventoryStock.item_id == item_id)
    if doctor_id is None:
        q = q.where(InventoryStock.doctor_id.is_(None))
    else:
        q = q.where(InventoryStock.doctor_id == doctor_id)
    return q


def _get_or_create_stock_row(
    db: Session,
    item_id: UUID,
    doctor_id: UUID | None,
) -> InventoryStock:
    row = db.scalars(_stock_query(item_id, doctor_id).with_for_update(of=InventoryStock)).first()
    if row is not None:
        return row
    row = InventoryStock(item_id=item_id, doctor_id=doctor_id, quantity=0)
    db.add(row)
    db.flush()
    locked = db.scalars(_stock_query(item_id, doctor_id).with_for_update(of=InventoryStock)).first()
    return locked if locked is not None else row


def _apply_movement(
    db: Session,
    item: InventoryItem,
    doctor_id: UUID | None,
    movement_type: InventoryMovementType,
    quantity: int,
    *,
    billing_id: UUID | None,
) -> tuple[InventoryMovement, int]:
    _validate_doctor_for_item_tenant(db, doctor_id, item.tenant_id)
    _validate_billing_reference(db, billing_id, item.tenant_id)

    stock = _get_or_create_stock_row(db, item.id, doctor_id)

    if movement_type == InventoryMovementType.IN:
        if quantity < 1:
            raise ValidationError("IN movement requires a positive quantity")
        delta = quantity
    elif movement_type == InventoryMovementType.OUT:
        if quantity < 1:
            raise ValidationError("OUT movement requires a positive quantity")
        delta = -quantity
    else:
        delta = quantity

    new_balance = stock.quantity + delta
    if new_balance < 0:
        raise ValidationError("Insufficient stock (cannot go negative)")

    stock.quantity = new_balance
    movement = InventoryMovement(
        item_id=item.id,
        doctor_id=doctor_id,
        type=movement_type,
        quantity=quantity,
        billing_id=billing_id,
    )
    db.add(movement)
    db.flush()
    return movement, new_balance


def create_item(
    db: Session,
    data: InventoryItemCreate,
    current_user: User,
    tenant_id: UUID | None,
) -> InventoryItem:
    _forbid_patients(current_user)
    effective_tenant = _resolve_item_tenant_for_create(tenant_id)
    assert_authorized(
        "create",
        "inventory",
        current_user,
        tenant_id,
        resource_tenant_id=effective_tenant,
    )

    item = InventoryItem(
        tenant_id=effective_tenant,
        name=data.name,
        type=data.type,
        unit=data.unit,
        cost_price=data.cost_price,
        selling_price=data.selling_price,
        is_active=data.is_active,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    logger.info(
        "[INVENTORY] created item id=%s tenant=%s by user=%s",
        item.id,
        item.tenant_id,
        current_user.id,
    )
    return item


def update_item(
    db: Session,
    item_id: UUID,
    data: InventoryItemUpdate,
    current_user: User,
    tenant_id: UUID | None,
) -> InventoryItem:
    _forbid_patients(current_user)
    item = get_item_or_404(db, item_id)
    _authorize_item_tenant(item, current_user, tenant_id)

    payload = data.model_dump(exclude_unset=True)
    for k, v in payload.items():
        setattr(item, k, v)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_items(
    db: Session,
    current_user: User,
    tenant_id: UUID | None,
    *,
    skip: int = 0,
    limit: int = 50,
    type_filter: InventoryItemType | None = None,
    active_only: bool = False,
) -> list[InventoryItem]:
    _forbid_patients(current_user)
    if tenant_id is None:
        raise ValidationError("X-Tenant-ID header is required")
    q = select(InventoryItem).where(InventoryItem.tenant_id == tenant_id)

    if type_filter:
        q = q.where(InventoryItem.type == type_filter)
    if active_only:
        q = q.where(InventoryItem.is_active.is_(True))

    q = q.order_by(InventoryItem.name.asc()).offset(skip).limit(limit)
    return list(db.scalars(q).all())


def add_stock(
    db: Session,
    body: StockAddRequest,
    current_user: User,
    tenant_id: UUID | None,
) -> tuple[UUID, int]:
    _forbid_patients(current_user)
    item = get_item_or_404(db, body.item_id)
    _authorize_item_tenant(item, current_user, tenant_id)
    if not item.is_active:
        raise ValidationError("Cannot adjust stock for an inactive item")

    movement, balance = _apply_movement(
        db,
        item,
        body.doctor_id,
        InventoryMovementType.IN,
        body.quantity,
        billing_id=body.billing_id,
    )
    db.commit()
    db.refresh(movement)
    return movement.id, balance


def reduce_stock(
    db: Session,
    body: StockReduceRequest,
    current_user: User,
    tenant_id: UUID | None,
) -> tuple[UUID, int]:
    _forbid_patients(current_user)
    item = get_item_or_404(db, body.item_id)
    _authorize_item_tenant(item, current_user, tenant_id)
    if not item.is_active:
        raise ValidationError("Cannot adjust stock for an inactive item")

    movement, balance = _apply_movement(
        db,
        item,
        body.doctor_id,
        InventoryMovementType.OUT,
        body.quantity,
        billing_id=body.billing_id,
    )
    db.commit()
    db.refresh(movement)
    return movement.id, balance


def adjust_stock(
    db: Session,
    body: StockAdjustRequest,
    current_user: User,
    tenant_id: UUID | None,
) -> tuple[UUID, int]:
    _forbid_patients(current_user)
    item = get_item_or_404(db, body.item_id)
    _authorize_item_tenant(item, current_user, tenant_id)
    if not item.is_active:
        raise ValidationError("Cannot adjust stock for an inactive item")

    movement, balance = _apply_movement(
        db,
        item,
        body.doctor_id,
        InventoryMovementType.ADJUST,
        body.quantity,
        billing_id=body.billing_id,
    )
    db.commit()
    db.refresh(movement)
    return movement.id, balance
