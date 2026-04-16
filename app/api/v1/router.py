from fastapi import APIRouter

from app.api.v1.endpoints import appointment, auth, doctor, health, patient, users

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(patient.router)
api_router.include_router(doctor.router)
api_router.include_router(appointment.router)
