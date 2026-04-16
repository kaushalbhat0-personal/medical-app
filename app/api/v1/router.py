from fastapi import APIRouter

from app.api.v1.endpoints import appointment, auth, billing, dashboard, doctor, health, patient, users

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(patient.router)
api_router.include_router(doctor.router)
api_router.include_router(appointment.router)
api_router.include_router(billing.router)
api_router.include_router(dashboard.router, prefix="/dashboard")
