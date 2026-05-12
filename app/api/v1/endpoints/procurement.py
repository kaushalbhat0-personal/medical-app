"""FastAPI endpoints for procurement: suppliers, purchase orders, reports."""

import logging
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User
from app.schemas.procurement import (
    InwardOutwardValuationResponse,
    InwardOutwardValuationRow,
    ProcurementReportResponse,
    ProcurementReportRow,
    PurchaseOrderCreate,
    PurchaseOrderListResponse,
    PurchaseOrderResponse,
    StockValuationResponse,
    SupplierCreate,
    SupplierListResponse,
    SupplierResponse,
    SupplierUpdate,
    TaxSummaryResponse,
    TaxSummaryRow,
)
from app.services.procurement_service import (
    cancel_purchase_order,
    complete_purchase_order,
    create_purchase_order,
    create_supplier,
    get_procurement_report,
    get_purchase_order,
    get_supplier,
    get_tax_summary,
    list_purchase_orders,
    list_suppliers,
    update_supplier,
)
from app.services.procurement_valuation import (
    get_inward_vs_outward_valuation,
    get_stock_value_snapshot,
)
from app.utils.export_service import CsvExportBuilder

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/procurement", tags=["procurement"])


# ── Helper to build response ────────────────────────────────────────────────


def _po_to_response(po, supplier_name: str | None = None) -> PurchaseOrderResponse:
    items = []
    for poi in po.items:
        items.append(
            {
                "id": poi.id,
                "purchase_order_id": poi.purchase_order_id,
                "inventory_item_id": poi.inventory_item_id,
                "quantity": poi.quantity,
                "unit_cost": Decimal(str(poi.unit_cost)),
                "tax_percent": Decimal(str(poi.tax_percent)),
                "batch_number": poi.batch_number,
                "expiry_date": poi.expiry_date,
                "line_total": Decimal(str(poi.line_total)),
                "inventory_item_name": poi.inventory_item.name if poi.inventory_item else None,
            }
        )
    return PurchaseOrderResponse(
        id=po.id,
        tenant_id=po.tenant_id,
        supplier_id=po.supplier_id,
        invoice_number=po.invoice_number,
        invoice_date=po.invoice_date,
        subtotal=Decimal(str(po.subtotal)),
        tax_amount=Decimal(str(po.tax_amount)),
        discount_amount=Decimal(str(po.discount_amount)),
        total_amount=Decimal(str(po.total_amount)),
        payment_status=po.payment_status.value if hasattr(po.payment_status, "value") else po.payment_status,
        payment_method=po.payment_method,
        status=po.status.value if hasattr(po.status, "value") else po.status,
        notes=po.notes,
        created_by=po.created_by,
        created_at=po.created_at,
        updated_at=po.updated_at,
        supplier_name=supplier_name or (po.supplier.supplier_name if po.supplier else None),
        items=items,
    )


# ── Supplier Endpoints ──────────────────────────────────────────────────────


@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def api_create_supplier(
    data: SupplierCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    tenant_id: UUID | None = Depends(deps.get_optional_scoped_tenant_id),
):
    """Create a new supplier (tenant-scoped)."""
    supplier = create_supplier(db, data, current_user, tenant_id)
    return SupplierResponse.model_validate(supplier)


@router.get("/suppliers", response_model=SupplierListResponse)
def api_list_suppliers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str | None = Query(None),
    active_only: bool = Query(False),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    tenant_id: UUID | None = Depends(deps.get_optional_scoped_tenant_id),
):
    """List suppliers with optional search and filtering."""
    suppliers, total = list_suppliers(
        db, current_user, tenant_id, skip=skip, limit=limit, search=search, active_only=active_only
    )
    return SupplierListResponse(
        suppliers=[SupplierResponse.model_validate(s) for s in suppliers],
        total=total,
    )


@router.get("/suppliers/{supplier_id}", response_model=SupplierResponse)
def api_get_supplier(
    supplier_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    tenant_id: UUID | None = Depends(deps.get_optional_scoped_tenant_id),
):
    """Get a single supplier by ID."""
    supplier = get_supplier(db, supplier_id, current_user, tenant_id)
    return SupplierResponse.model_validate(supplier)


@router.put("/suppliers/{supplier_id}", response_model=SupplierResponse)
def api_update_supplier(
    supplier_id: UUID,
    data: SupplierUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    tenant_id: UUID | None = Depends(deps.get_optional_scoped_tenant_id),
):
    """Update a supplier."""
    supplier = update_supplier(db, supplier_id, data, current_user, tenant_id)
    return SupplierResponse.model_validate(supplier)


# ── Purchase Order Endpoints ────────────────────────────────────────────────


@router.post("/purchase-orders", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
def api_create_purchase_order(
    data: PurchaseOrderCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    tenant_id: UUID | None = Depends(deps.get_optional_scoped_tenant_id),
):
    """Create a new purchase order in draft status."""
    po = create_purchase_order(db, data, current_user, tenant_id)
    return _po_to_response(po)


@router.get("/purchase-orders", response_model=PurchaseOrderListResponse)
def api_list_purchase_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: str | None = Query(None, alias="status"),
    supplier_id: UUID | None = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    tenant_id: UUID | None = Depends(deps.get_optional_scoped_tenant_id),
):
    """List purchase orders with optional filtering."""
    pos, total = list_purchase_orders(
        db, current_user, tenant_id,
        skip=skip, limit=limit, status_filter=status_filter, supplier_id=supplier_id,
    )
    return PurchaseOrderListResponse(
        purchase_orders=[_po_to_response(po) for po in pos],
        total=total,
    )


@router.get("/purchase-orders/{po_id}", response_model=PurchaseOrderResponse)
def api_get_purchase_order(
    po_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    tenant_id: UUID | None = Depends(deps.get_optional_scoped_tenant_id),
):
    """Get a single purchase order by ID."""
    po = get_purchase_order(db, po_id, current_user, tenant_id)
    return _po_to_response(po)


@router.post("/purchase-orders/{po_id}/complete", response_model=PurchaseOrderResponse)
def api_complete_purchase_order(
    po_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    tenant_id: UUID | None = Depends(deps.get_optional_scoped_tenant_id),
):
    """
    Complete a purchase order — the critical stock-inward operation.
    Increases stock, creates PROCUREMENT_IN movements, updates valuation.
    """
    po = complete_purchase_order(db, po_id, current_user, tenant_id)
    return _po_to_response(po)


@router.post("/purchase-orders/{po_id}/cancel", response_model=PurchaseOrderResponse)
def api_cancel_purchase_order(
    po_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    tenant_id: UUID | None = Depends(deps.get_optional_scoped_tenant_id),
):
    """Cancel a purchase order. Reverses stock if already completed."""
    po = cancel_purchase_order(db, po_id, current_user, tenant_id)
    return _po_to_response(po)


# ── Reports ─────────────────────────────────────────────────────────────────


@router.get("/reports/procurement", response_model=ProcurementReportResponse)
def api_procurement_report(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    tenant_id: UUID | None = Depends(deps.get_optional_scoped_tenant_id),
):
    """Aggregated procurement report with supplier details."""
    rows = get_procurement_report(db, current_user, tenant_id, date_from=date_from, date_to=date_to)
    report_rows = [ProcurementReportRow(**r) for r in rows]
    totals = {
        "total_subtotal": sum(r.subtotal for r in report_rows),
        "total_tax": sum(r.tax_amount for r in report_rows),
        "total_amount": sum(r.total_amount for r in report_rows),
        "grand_total": sum(r.total_amount for r in report_rows),
    }
    return ProcurementReportResponse(rows=report_rows, **totals)


@router.get("/reports/tax-summary", response_model=TaxSummaryResponse)
def api_tax_summary(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    tenant_id: UUID | None = Depends(deps.get_optional_scoped_tenant_id),
):
    """GST-ready tax summary grouped by supplier and invoice."""
    rows = get_tax_summary(db, current_user, tenant_id, date_from=date_from, date_to=date_to)
    tax_rows = [TaxSummaryRow(**r) for r in rows]
    totals = {
        "total_taxable_value": sum(r.taxable_value for r in tax_rows),
        "total_tax": sum(r.total_tax for r in tax_rows),
    }
    return TaxSummaryResponse(rows=tax_rows, **totals)


@router.get("/reports/stock-valuation", response_model=StockValuationResponse)
def api_stock_valuation(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    tenant_id: UUID | None = Depends(deps.get_optional_scoped_tenant_id),
):
    """Current stock valuation snapshot at cost and selling price."""
    from app.services.security_audit import assert_authorized
    from app.services.exceptions import ValidationError

    if tenant_id is None:
        raise ValidationError("X-Tenant-ID header is required")
    assert_authorized("read", "inventory", current_user, tenant_id, resource_tenant_id=tenant_id)

    snapshot = get_stock_value_snapshot(db, tenant_id)
    return StockValuationResponse(**snapshot)


@router.get("/reports/inward-outward-valuation", response_model=InwardOutwardValuationResponse)
def api_inward_outward_valuation(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    tenant_id: UUID | None = Depends(deps.get_optional_scoped_tenant_id),
):
    """Inward vs outward valuation comparison by month."""
    from app.services.security_audit import assert_authorized
    from app.services.exceptions import ValidationError

    if tenant_id is None:
        raise ValidationError("X-Tenant-ID header is required")
    assert_authorized("read", "inventory", current_user, tenant_id, resource_tenant_id=tenant_id)

    rows = get_inward_vs_outward_valuation(db, tenant_id, date_from=date_from, date_to=date_to)
    val_rows = [InwardOutwardValuationRow(**r) for r in rows]
    totals = {
        "total_inward_qty": sum(r.inward_qty for r in val_rows),
        "total_inward_value": sum(r.inward_value for r in val_rows),
        "total_outward_qty": sum(r.outward_qty for r in val_rows),
        "total_outward_value": sum(r.outward_value for r in val_rows),
    }
    return InwardOutwardValuationResponse(rows=val_rows, **totals)


# ── CSV Exports ─────────────────────────────────────────────────────────────


@router.get("/exports/procurement-csv")
def api_export_procurement_csv(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    tenant_id: UUID | None = Depends(deps.get_optional_scoped_tenant_id),
):
    """Export procurement report as CSV."""
    rows = get_procurement_report(db, current_user, tenant_id, date_from=date_from, date_to=date_to)
    builder = CsvExportBuilder(
        filename="procurement_report",
        headers=[
            "Purchase Order ID",
            "Invoice Number",
            "Invoice Date",
            "Supplier",
            "GST Number",
            "Item Count",
            "Total Qty",
            "Subtotal",
            "Tax Amount",
            "Total Amount",
            "Status",
            "Created At",
        ],
    )
    for r in rows:
        builder.add_row(
            [
                str(r["purchase_order_id"]),
                r["invoice_number"] or "",
                str(r["invoice_date"]) if r["invoice_date"] else "",
                r["supplier_name"],
                r["supplier_gst"] or "",
                str(r["item_count"]),
                str(r["total_qty"]),
                str(r["subtotal"]),
                str(r["tax_amount"]),
                str(r["total_amount"]),
                r["status"],
                str(r["created_at"]),
            ]
        )
    return builder.streaming_response()


@router.get("/exports/tax-csv")
def api_export_tax_csv(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    tenant_id: UUID | None = Depends(deps.get_optional_scoped_tenant_id),
):
    """Export tax summary as CSV (GST-ready)."""
    rows = get_tax_summary(db, current_user, tenant_id, date_from=date_from, date_to=date_to)
    builder = CsvExportBuilder(
        filename="tax_summary",
        headers=[
            "Supplier",
            "GST Number",
            "Invoice Number",
            "Invoice Date",
            "Taxable Value",
            "Total Tax",
            "Item Count",
        ],
    )
    for r in rows:
        builder.add_row(
            [
                r["supplier_name"],
                r["gst_number"] or "",
                r["invoice_number"] or "",
                str(r["invoice_date"]) if r["invoice_date"] else "",
                str(r["taxable_value"]),
                str(r["total_tax"]),
                str(r["item_count"]),
            ]
        )
    return builder.streaming_response()
