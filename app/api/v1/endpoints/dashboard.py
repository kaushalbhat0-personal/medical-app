import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.dashboard import (
    AdminDashboardMetricsResponse,
    DashboardResponse,
    DoctorPerformanceItem,
    RevenueTrendItem,
)
from app.services import dashboard_service

router = APIRouter()
admin_router = APIRouter(tags=["admin", "dashboard"])
logger = logging.getLogger(__name__)


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DashboardResponse:
    """
    Get dashboard statistics including:
    - Total patients count
    - Total doctors count
    - Today's appointments count
    - Total revenue (sum of paid bills)
    """
    logger.info("Dashboard endpoint hit - fetching stats")

    stats = dashboard_service.get_dashboard_stats(db)

    logger.info(
        "Dashboard stats returned - patients: %s, doctors: %s, today_appointments: %s, revenue: %s",
        stats["total_patients"],
        stats["total_doctors"],
        stats["today_appointments"],
        stats["total_revenue"],
    )

    return DashboardResponse(**stats)


@admin_router.get("/dashboard/metrics", response_model=AdminDashboardMetricsResponse)
def get_admin_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_tenant_id: UUID | None = Header(
        default=None,
        alias="X-Tenant-ID",
        description="Tenant to scope admin dashboard metrics (required)",
    ),
    _legacy_tenant_id: UUID | None = Query(
        default=None,
        alias="tenant_id",
        description="Deprecated; use X-Tenant-ID. Ignored.",
    ),
) -> AdminDashboardMetricsResponse:
    dashboard_service.authorize_admin_dashboard_access(current_user)
    if x_tenant_id is None:
        raise HTTPException(
            status_code=400, detail="X-Tenant-ID header is required for dashboard metrics"
        )
    tenant_id = dashboard_service.resolve_admin_metrics_tenant_id(db, current_user, x_tenant_id)
    logger.info("TENANT ID: %s", tenant_id)
    metrics = dashboard_service.get_admin_dashboard_metrics(db, tenant_id)
    return AdminDashboardMetricsResponse.model_validate(metrics)


@admin_router.get("/dashboard/revenue-trend", response_model=list[RevenueTrendItem])
def get_admin_revenue_trend(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_tenant_id: UUID | None = Header(
        default=None,
        alias="X-Tenant-ID",
    ),
    _legacy_tenant_id: UUID | None = Query(
        default=None,
        alias="tenant_id",
        description="Deprecated; use X-Tenant-ID. Ignored.",
    ),
) -> list[RevenueTrendItem]:
    dashboard_service.authorize_admin_dashboard_access(current_user)
    if x_tenant_id is None:
        raise HTTPException(
            status_code=400, detail="X-Tenant-ID header is required for dashboard metrics"
        )
    tenant_id = dashboard_service.resolve_admin_metrics_tenant_id(db, current_user, x_tenant_id)
    logger.info("TENANT ID: %s", tenant_id)
    rows = dashboard_service.get_revenue_trend(db, tenant_id)
    return [RevenueTrendItem.model_validate(x) for x in rows]


@admin_router.get(
    "/dashboard/doctor-performance",
    response_model=list[DoctorPerformanceItem],
)
def get_admin_doctor_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_tenant_id: UUID | None = Header(
        default=None,
        alias="X-Tenant-ID",
    ),
    _legacy_tenant_id: UUID | None = Query(
        default=None,
        alias="tenant_id",
        description="Deprecated; use X-Tenant-ID. Ignored.",
    ),
) -> list[DoctorPerformanceItem]:
    dashboard_service.authorize_admin_dashboard_access(current_user)
    if x_tenant_id is None:
        raise HTTPException(
            status_code=400, detail="X-Tenant-ID header is required for dashboard metrics"
        )
    tenant_id = dashboard_service.resolve_admin_metrics_tenant_id(db, current_user, x_tenant_id)
    logger.info("TENANT ID: %s", tenant_id)
    rows = dashboard_service.get_doctor_performance(db, tenant_id)
    return [DoctorPerformanceItem.model_validate(x) for x in rows]
