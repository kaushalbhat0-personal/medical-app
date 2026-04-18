from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
import pytz

from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.appointment import Appointment
from app.models.billing import Billing


def get_dashboard_stats(db: Session) -> dict:
    total_patients = db.query(Patient).count()
    total_doctors = db.query(Doctor).count()

    # Use IST timezone for accurate "today" filtering
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)

    today_appointments = db.query(Appointment).filter(
        Appointment.appointment_time >= start,
        Appointment.appointment_time < end,
        Appointment.is_deleted == False
    ).count()

    total_revenue = db.query(func.sum(Billing.amount)).filter(
        Billing.status == "paid",
        Billing.is_deleted == False
    ).scalar() or 0

    return {
        "total_patients": total_patients,
        "total_doctors": total_doctors,
        "today_appointments": today_appointments,
        "total_revenue": float(total_revenue),
    }
