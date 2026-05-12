"""Inventory valuation helpers for procurement foundation.

Provides:
- Average cost foundation
- Stock value snapshot
- Inward vs outward valuation

NO FIFO engine, NO double-entry accounting — just foundational valuation support.
"""

import logging
from datetime import date
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

logger = logging.getLogger(__name__)


def compute_weighted_average(
    current_qty: int,
    current_cost: Decimal,
    new_qty: int,
    new_unit_cost: Decimal,
) -> Decimal:
    """Simple weighted average cost calculation.

    Args:
        current_qty: Current stock quantity
        current_cost: Current cost price per unit
        new_qty: New incoming quantity
        new_unit_cost: New unit cost

    Returns:
        Weighted average cost rounded to 2 decimal places.
    """
    total_qty = current_qty + new_qty
    if total_qty == 0:
        return Decimal("0.00")
    total_value = (current_qty * current_cost) + (new_qty * new_unit_cost)
    return (total_value / total_qty).quantize(Decimal("0.01"))


def get_stock_value_snapshot(
    db: Session,
    tenant_id: UUID,
) -> dict:
    """Returns total inventory value at average cost and selling price.

    Returns:
        dict with total_items, total_quantity, total_value_at_cost, total_value_at_selling
    """
    q = (
        select(
            func.count(InventoryItem.id).label("total_items"),
            func.coalesce(func.sum(InventoryStock.quantity), 0).label("total_quantity"),
            func.coalesce(
                func.sum(InventoryStock.quantity * InventoryItem.cost_price), 0
            ).label("total_value_at_cost"),
            func.coalesce(
                func.sum(InventoryStock.quantity * InventoryItem.selling_price), 0
            ).label("total_value_at_selling"),
        )
        .select_from(InventoryItem)
        .outerjoin(
            InventoryStock,
            InventoryStock.item_id == InventoryItem.id,
        )
        .where(InventoryItem.tenant_id == tenant_id)
        .where(InventoryStock.doctor_id.is_(None))
    )

    row = db.execute(q).one()
    return {
        "total_items": int(row[0]),
        "total_quantity": int(row[1]),
        "total_value_at_cost": Decimal(str(row[2])).quantize(Decimal("0.01")),
        "total_value_at_selling": Decimal(str(row[3])).quantize(Decimal("0.01")),
    }


def get_inward_vs_outward_valuation(
    db: Session,
    tenant_id: UUID,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[dict]:
    """Compares procurement-in vs consumption-out valuation.

    Groups by month for trend analysis.

    Returns:
        List of dicts with period, inward_qty, inward_value, outward_qty, outward_value
    """
    # Inward movements (PROCUREMENT_IN)
    inward_q = (
        select(
            func.date_trunc("month", InventoryMovement.created_at).label("period"),
            func.coalesce(func.sum(InventoryMovement.quantity), 0).label("qty"),
            func.coalesce(
                func.sum(
                    func.coalesce(InventoryMovement.unit_cost, 0)
                    * InventoryMovement.quantity
                ),
                0,
            ).label("value"),
        )
        .select_from(InventoryMovement)
        .join(InventoryItem, InventoryItem.id == InventoryMovement.item_id)
        .where(InventoryItem.tenant_id == tenant_id)
        .where(InventoryMovement.type == InventoryMovementType.PROCUREMENT_IN)
    )

    if date_from:
        inward_q = inward_q.where(InventoryMovement.created_at >= date_from)
    if date_to:
        inward_q = inward_q.where(InventoryMovement.created_at <= date_to)

    inward_q = inward_q.group_by("period").order_by("period")
    inward_rows = db.execute(inward_q).all()
    inward_by_period = {
        str(r[0]): {"qty": int(r[1]), "value": Decimal(str(r[2])).quantize(Decimal("0.01"))}
        for r in inward_rows
    }

    # Outward movements (OUT)
    outward_q = (
        select(
            func.date_trunc("month", InventoryMovement.created_at).label("period"),
            func.coalesce(func.sum(InventoryMovement.quantity), 0).label("qty"),
            func.coalesce(
                func.sum(
                    func.coalesce(InventoryMovement.unit_cost, 0)
                    * InventoryMovement.quantity
                ),
                0,
            ).label("value"),
        )
        .select_from(InventoryMovement)
        .join(InventoryItem, InventoryItem.id == InventoryMovement.item_id)
        .where(InventoryItem.tenant_id == tenant_id)
        .where(InventoryMovement.type == InventoryMovementType.OUT)
    )

    if date_from:
        outward_q = outward_q.where(InventoryMovement.created_at >= date_from)
    if date_to:
        outward_q = outward_q.where(InventoryMovement.created_at <= date_to)

    outward_q = outward_q.group_by("period").order_by("period")
    outward_rows = db.execute(outward_q).all()
    outward_by_period = {
        str(r[0]): {"qty": int(r[1]), "value": Decimal(str(r[2])).quantize(Decimal("0.01"))}
        for r in outward_rows
    }

    # Merge periods
    all_periods = sorted(set(list(inward_by_period.keys()) + list(outward_by_period.keys())))
    result = []
    for period in all_periods:
        inward = inward_by_period.get(period, {"qty": 0, "value": Decimal("0.00")})
        outward = outward_by_period.get(period, {"qty": 0, "value": Decimal("0.00")})
        result.append(
            {
                "period": period,
                "inward_qty": inward["qty"],
                "inward_value": inward["value"],
                "outward_qty": outward["qty"],
                "outward_value": outward["value"],
            }
        )

    return result
