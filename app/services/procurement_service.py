"""Procurement service: supplier CRUD, purchase order lifecycle, stock inward."""

import logging
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.inventory import (
    InventoryItem,
    InventoryMovement,
    InventoryMovementType,
    InventoryStock,
)
from app.models.purchase_order import (
    PaymentStatus,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderStatus,
)
from app.models.supplier import Supplier
from app.models.user import User, UserRole
from app.schemas.procurement import (
    PurchaseOrderCreate,
    PurchaseOrderItemCreate,
    SupplierCreate,
    SupplierUpdate,
)
from app.services.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.services.security_audit import (
    assert_authorized,
    log_audit_mutation,
    log_rbac_mutation_violation,
)

logger = logging.getLogger(__name__)

MISSING_TENANT_MSG = "X-Tenant-ID header is required"


# ── Helpers ─────────────────────────────────────────────────────────────────


def _forbid_patients(current_user: User, action: str = "procurement") -> None:
    if current_user.role == UserRole.patient:
        log_rbac_mutation_violation(current_user, action)
        raise ForbiddenError("Patients cannot access procurement")


def _require_tenant(tenant_id: UUID | None) -> UUID:
    if tenant_id is None:
        raise ValidationError(MISSING_TENANT_MSG)
    return tenant_id


def _get_supplier_or_404(db: Session, supplier_id: UUID) -> Supplier:
    s = db.get(Supplier, supplier_id)
    if s is None:
        raise NotFoundError("Supplier not found")
    return s


def _get_po_or_404(db: Session, po_id: UUID) -> PurchaseOrder:
    po = db.get(PurchaseOrder, po_id)
    if po is None:
        raise NotFoundError("Purchase order not found")
    return po


def _get_item_or_404(db: Session, item_id: UUID) -> InventoryItem:
    item = db.get(InventoryItem, item_id)
    if item is None:
        raise NotFoundError("Inventory item not found")
    return item


def _compute_weighted_average(
    current_qty: int,
    current_cost: Decimal,
    new_qty: int,
    new_unit_cost: Decimal,
) -> Decimal:
    """Simple weighted average cost calculation."""
    total_qty = current_qty + new_qty
    if total_qty == 0:
        return Decimal("0.00")
    total_value = (current_qty * current_cost) + (new_qty * new_unit_cost)
    return (total_value / total_qty).quantize(Decimal("0.01"))


# ── Supplier CRUD ───────────────────────────────────────────────────────────


def create_supplier(
    db: Session,
    data: SupplierCreate,
    current_user: User,
    tenant_id: UUID | None,
) -> Supplier:
    _forbid_patients(current_user)
    effective_tenant = _require_tenant(tenant_id)
    assert_authorized(
        "create", "supplier", current_user, tenant_id, resource_tenant_id=effective_tenant
    )

    supplier = Supplier(
        tenant_id=effective_tenant,
        supplier_name=data.supplier_name,
        contact_person=data.contact_person,
        phone=data.phone,
        email=data.email,
        address=data.address,
        gst_number=data.gst_number,
        tax_id=data.tax_id,
        notes=data.notes,
        is_active=data.is_active,
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)

    log_audit_mutation(
        "create_supplier",
        current_user,
        "supplier",
        supplier.id,
        effective_tenant,
    )
    logger.info(
        "[PROCUREMENT] created supplier id=%s tenant=%s by user=%s",
        supplier.id,
        effective_tenant,
        current_user.id,
    )
    return supplier


def list_suppliers(
    db: Session,
    current_user: User,
    tenant_id: UUID | None,
    *,
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    active_only: bool = False,
) -> tuple[list[Supplier], int]:
    _forbid_patients(current_user)
    effective_tenant = _require_tenant(tenant_id)

    q = select(Supplier).where(Supplier.tenant_id == effective_tenant)
    count_q = select(func.count(Supplier.id)).where(Supplier.tenant_id == effective_tenant)

    if active_only:
        q = q.where(Supplier.is_active.is_(True))
        count_q = count_q.where(Supplier.is_active.is_(True))
    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.where(Supplier.supplier_name.ilike(term))
        count_q = count_q.where(Supplier.supplier_name.ilike(term))

    total = db.scalar(count_q) or 0
    q = q.order_by(Supplier.supplier_name.asc()).offset(skip).limit(limit)
    suppliers = list(db.scalars(q).all())
    return suppliers, total


def get_supplier(
    db: Session,
    supplier_id: UUID,
    current_user: User,
    tenant_id: UUID | None,
) -> Supplier:
    _forbid_patients(current_user)
    supplier = _get_supplier_or_404(db, supplier_id)
    assert_authorized(
        "read", "supplier", current_user, tenant_id, resource_tenant_id=supplier.tenant_id
    )
    return supplier


def update_supplier(
    db: Session,
    supplier_id: UUID,
    data: SupplierUpdate,
    current_user: User,
    tenant_id: UUID | None,
) -> Supplier:
    _forbid_patients(current_user)
    supplier = _get_supplier_or_404(db, supplier_id)
    assert_authorized(
        "update", "supplier", current_user, tenant_id, resource_tenant_id=supplier.tenant_id
    )

    payload = data.model_dump(exclude_unset=True)
    for k, v in payload.items():
        setattr(supplier, k, v)
    db.add(supplier)
    db.commit()
    db.refresh(supplier)

    log_audit_mutation(
        "update_supplier",
        current_user,
        "supplier",
        supplier.id,
        supplier.tenant_id,
    )
    return supplier


# ── Purchase Order ──────────────────────────────────────────────────────────


def create_purchase_order(
    db: Session,
    data: PurchaseOrderCreate,
    current_user: User,
    tenant_id: UUID | None,
) -> PurchaseOrder:
    _forbid_patients(current_user)
    effective_tenant = _require_tenant(tenant_id)
    assert_authorized(
        "create", "purchase_order", current_user, tenant_id, resource_tenant_id=effective_tenant
    )

    # Validate supplier belongs to tenant
    supplier = _get_supplier_or_404(db, data.supplier_id)
    if supplier.tenant_id != effective_tenant:
        raise ValidationError("Supplier does not belong to this organization")

    # Validate all items belong to tenant
    for item_data in data.items:
        item = _get_item_or_404(db, item_data.inventory_item_id)
        if item.tenant_id != effective_tenant:
            raise ValidationError(
                f"Inventory item {item.name!r} does not belong to this organization"
            )

    po = PurchaseOrder(
        tenant_id=effective_tenant,
        supplier_id=data.supplier_id,
        invoice_number=data.invoice_number,
        invoice_date=data.invoice_date,
        subtotal=data.subtotal,
        tax_amount=data.tax_amount,
        discount_amount=data.discount_amount,
        total_amount=data.total_amount,
        payment_status=data.payment_status,
        payment_method=data.payment_method,
        status=PurchaseOrderStatus.draft,
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(po)
    db.flush()

    for item_data in data.items:
        poi = PurchaseOrderItem(
            purchase_order_id=po.id,
            inventory_item_id=item_data.inventory_item_id,
            quantity=item_data.quantity,
            unit_cost=item_data.unit_cost,
            tax_percent=item_data.tax_percent,
            batch_number=item_data.batch_number,
            expiry_date=item_data.expiry_date,
            line_total=item_data.line_total,
        )
        db.add(poi)

    db.commit()
    db.refresh(po)

    log_audit_mutation(
        "create_purchase_order",
        current_user,
        "purchase_order",
        po.id,
        effective_tenant,
    )
    logger.info(
        "[PROCUREMENT] created PO id=%s tenant=%s supplier=%s total=%s by user=%s",
        po.id,
        effective_tenant,
        data.supplier_id,
        data.total_amount,
        current_user.id,
    )
    return po


def complete_purchase_order(
    db: Session,
    po_id: UUID,
    current_user: User,
    tenant_id: UUID | None,
) -> PurchaseOrder:
    """
    The critical stock-inward operation:
    1. Validates PO is in "draft" status
    2. For each item: creates PROCUREMENT_IN movement
    3. Increases stock via tenant-level stock row
    4. Updates item cost_price = weighted average
    5. Sets PO status to "completed"
    6. Logs audit event with full details
    """
    _forbid_patients(current_user)
    po = _get_po_or_404(db, po_id)
    assert_authorized(
        "update", "purchase_order", current_user, tenant_id, resource_tenant_id=po.tenant_id
    )

    if po.status != PurchaseOrderStatus.draft:
        raise ValidationError(
            f"Cannot complete purchase order in status '{po.status.value}'; must be 'draft'"
        )

    # Process each item
    for poi in po.items:
        item = _get_item_or_404(db, poi.inventory_item_id)

        # Get or create tenant-level stock row
        stock_row = db.scalars(
            select(InventoryStock).where(
                InventoryStock.item_id == item.id,
                InventoryStock.doctor_id.is_(None),
            )
        ).first()
        if stock_row is None:
            stock_row = InventoryStock(
                item_id=item.id,
                doctor_id=None,
                quantity=0,
            )
            db.add(stock_row)
            db.flush()

        current_qty = int(stock_row.quantity)
        current_cost = Decimal(str(item.cost_price))

        # Increase stock
        stock_row.quantity = current_qty + poi.quantity

        # Update weighted average cost
        new_avg = _compute_weighted_average(
            current_qty, current_cost, poi.quantity, poi.unit_cost
        )
        item.cost_price = float(new_avg)

        # Create PROCUREMENT_IN movement
        movement = InventoryMovement(
            item_id=item.id,
            doctor_id=None,
            type=InventoryMovementType.PROCUREMENT_IN,
            quantity=poi.quantity,
            billing_id=None,
            reference_type="PURCHASE_ORDER",
            reference_id=po.id,
            created_by=current_user.id,
            created_by_role=current_user.role.value,
            unit_cost=float(poi.unit_cost),
            supplier_id=po.supplier_id,
            invoice_number=po.invoice_number,
        )
        db.add(movement)

    # Mark PO as completed
    po.status = PurchaseOrderStatus.completed
    db.add(po)
    db.commit()
    db.refresh(po)

    log_audit_mutation(
        "complete_purchase_order",
        current_user,
        "purchase_order",
        po.id,
        po.tenant_id,
    )
    logger.info(
        "[PROCUREMENT] completed PO id=%s tenant=%s supplier=%s total=%s by user=%s",
        po.id,
        po.tenant_id,
        po.supplier_id,
        po.total_amount,
        current_user.id,
    )
    return po


def cancel_purchase_order(
    db: Session,
    po_id: UUID,
    current_user: User,
    tenant_id: UUID | None,
) -> PurchaseOrder:
    """
    Cancel a purchase order. If completed, reverses stock.
    """
    _forbid_patients(current_user)
    po = _get_po_or_404(db, po_id)
    assert_authorized(
        "update", "purchase_order", current_user, tenant_id, resource_tenant_id=po.tenant_id
    )

    if po.status == PurchaseOrderStatus.cancelled:
        raise ValidationError("Purchase order is already cancelled")

    # If completed, reverse stock
    if po.status == PurchaseOrderStatus.completed:
        for poi in po.items:
            item = _get_item_or_404(db, poi.inventory_item_id)
            stock_row = db.scalars(
                select(InventoryStock).where(
                    InventoryStock.item_id == item.id,
                    InventoryStock.doctor_id.is_(None),
                )
            ).first()
            if stock_row is not None:
                stock_row.quantity = int(stock_row.quantity) - poi.quantity
                if stock_row.quantity < 0:
                    stock_row.quantity = 0

            # Record reversal movement
            movement = InventoryMovement(
                item_id=item.id,
                doctor_id=None,
                type=InventoryMovementType.ADJUST,
                quantity=-poi.quantity,
                billing_id=None,
                reference_type="PURCHASE_ORDER_CANCEL",
                reference_id=po.id,
                created_by=current_user.id,
                created_by_role=current_user.role.value,
                unit_cost=float(poi.unit_cost),
                supplier_id=po.supplier_id,
                invoice_number=po.invoice_number,
            )
            db.add(movement)

    po.status = PurchaseOrderStatus.cancelled
    db.add(po)
    db.commit()
    db.refresh(po)

    log_audit_mutation(
        "cancel_purchase_order",
        current_user,
        "purchase_order",
        po.id,
        po.tenant_id,
    )
    return po


def list_purchase_orders(
    db: Session,
    current_user: User,
    tenant_id: UUID | None,
    *,
    skip: int = 0,
    limit: int = 50,
    status_filter: str | None = None,
    supplier_id: UUID | None = None,
) -> tuple[list[PurchaseOrder], int]:
    _forbid_patients(current_user)
    effective_tenant = _require_tenant(tenant_id)

    q = select(PurchaseOrder).where(PurchaseOrder.tenant_id == effective_tenant)
    count_q = select(func.count(PurchaseOrder.id)).where(
        PurchaseOrder.tenant_id == effective_tenant
    )

    if status_filter:
        q = q.where(PurchaseOrder.status == status_filter)
        count_q = count_q.where(PurchaseOrder.status == status_filter)
    if supplier_id:
        q = q.where(PurchaseOrder.supplier_id == supplier_id)
        count_q = count_q.where(PurchaseOrder.supplier_id == supplier_id)

    total = db.scalar(count_q) or 0
    q = q.order_by(PurchaseOrder.created_at.desc()).offset(skip).limit(limit)
    pos = list(db.scalars(q).all())
    return pos, total


def get_purchase_order(
    db: Session,
    po_id: UUID,
    current_user: User,
    tenant_id: UUID | None,
) -> PurchaseOrder:
    _forbid_patients(current_user)
    po = _get_po_or_404(db, po_id)
    assert_authorized(
        "read", "purchase_order", current_user, tenant_id, resource_tenant_id=po.tenant_id
    )
    return po


# ── Procurement Reports ─────────────────────────────────────────────────────


def get_procurement_report(
    db: Session,
    current_user: User,
    tenant_id: UUID | None,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[dict]:
    """Aggregated procurement report with supplier details."""
    _forbid_patients(current_user)
    effective_tenant = _require_tenant(tenant_id)

    q = (
        select(
            PurchaseOrder.id,
            PurchaseOrder.invoice_number,
            PurchaseOrder.invoice_date,
            Supplier.supplier_name,
            Supplier.gst_number,
            func.count(PurchaseOrderItem.id).label("item_count"),
            func.coalesce(func.sum(PurchaseOrderItem.quantity), 0).label("total_qty"),
            PurchaseOrder.subtotal,
            PurchaseOrder.tax_amount,
            PurchaseOrder.total_amount,
            PurchaseOrder.status,
            PurchaseOrder.created_at,
        )
        .join(Supplier, Supplier.id == PurchaseOrder.supplier_id)
        .outerjoin(
            PurchaseOrderItem,
            PurchaseOrderItem.purchase_order_id == PurchaseOrder.id,
        )
        .where(PurchaseOrder.tenant_id == effective_tenant)
        .group_by(
            PurchaseOrder.id,
            Supplier.supplier_name,
            Supplier.gst_number,
        )
    )

    if date_from:
        q = q.where(PurchaseOrder.created_at >= date_from)
    if date_to:
        q = q.where(PurchaseOrder.created_at <= date_to)

    q = q.order_by(PurchaseOrder.created_at.desc())
    rows = db.execute(q).all()

    result = []
    for r in rows:
        result.append(
            {
                "purchase_order_id": r[0],
                "invoice_number": r[1],
                "invoice_date": r[2],
                "supplier_name": r[3],
                "supplier_gst": r[4],
                "item_count": int(r[5]),
                "total_qty": int(r[6]),
                "subtotal": r[7],
                "tax_amount": r[8],
                "total_amount": r[9],
                "status": r[10].value if hasattr(r[10], "value") else r[10],
                "created_at": r[11],
            }
        )
    return result


def get_tax_summary(
    db: Session,
    current_user: User,
    tenant_id: UUID | None,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[dict]:
    """GST-ready tax summary grouped by supplier and invoice."""
    _forbid_patients(current_user)
    effective_tenant = _require_tenant(tenant_id)

    q = (
        select(
            Supplier.supplier_name,
            Supplier.gst_number,
            PurchaseOrder.invoice_number,
            PurchaseOrder.invoice_date,
            func.coalesce(func.sum(PurchaseOrderItem.line_total), 0).label("taxable_value"),
            func.coalesce(func.sum(PurchaseOrderItem.line_total * PurchaseOrderItem.tax_percent / 100), 0).label("total_tax"),
            func.count(PurchaseOrderItem.id).label("item_count"),
        )
        .select_from(PurchaseOrder)
        .join(Supplier, Supplier.id == PurchaseOrder.supplier_id)
        .join(
            PurchaseOrderItem,
            PurchaseOrderItem.purchase_order_id == PurchaseOrder.id,
        )
        .where(PurchaseOrder.tenant_id == effective_tenant)
        .where(PurchaseOrder.status == PurchaseOrderStatus.completed)
        .group_by(
            Supplier.supplier_name,
            Supplier.gst_number,
            PurchaseOrder.invoice_number,
            PurchaseOrder.invoice_date,
        )
    )

    if date_from:
        q = q.where(PurchaseOrder.created_at >= date_from)
    if date_to:
        q = q.where(PurchaseOrder.created_at <= date_to)

    q = q.order_by(Supplier.supplier_name, PurchaseOrder.invoice_date)
    rows = db.execute(q).all()

    result = []
    for r in rows:
        result.append(
            {
                "supplier_name": r[0],
                "gst_number": r[1],
                "invoice_number": r[2],
                "invoice_date": r[3],
                "taxable_value": r[4],
                "total_tax": r[5],
                "invoice_count": int(r[6]),
            }
        )
    return result
