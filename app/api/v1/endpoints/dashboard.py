import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard_service import get_dashboard_stats

router = APIRouter()
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
    
    stats = get_dashboard_stats(db)
    
    logger.info(
        f"Dashboard stats returned - patients: {stats['total_patients']}, "
        f"doctors: {stats['total_doctors']}, "
        f"today_appointments: {stats['today_appointments']}, "
        f"revenue: {stats['total_revenue']}"
    )
    
    return DashboardResponse(**stats)
