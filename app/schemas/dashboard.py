from pydantic import BaseModel, ConfigDict


class DashboardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    total_patients: int
    total_doctors: int
    today_appointments: int
    total_revenue: float
