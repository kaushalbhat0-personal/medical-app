from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin_doctor_verification,
    appointment,
    auth,
    billing,
    branding,
    communications,
    dashboard,
    doctor,
    doctor_profile,
    documents,
    encounter,
    health,
    inventory,
    medication_schedule,
    patient,
    patient_communication,
    patient_workspace,
    public_discovery,
    reporting,
    tenant,
    users,
)


api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(public_discovery.router)
api_router.include_router(patient.router)
api_router.include_router(tenant.router)
api_router.include_router(doctor.router)
api_router.include_router(doctor_profile.router)
api_router.include_router(appointment.router)
api_router.include_router(billing.router)
api_router.include_router(inventory.router)
api_router.include_router(encounter.router)
api_router.include_router(reporting.router)
api_router.include_router(dashboard.router, prefix="/dashboard")
api_router.include_router(dashboard.admin_router, prefix="/admin")
api_router.include_router(admin_doctor_verification.router, prefix="/admin")
api_router.include_router(documents.router)
api_router.include_router(branding.router)
api_router.include_router(communications.router)
api_router.include_router(patient_workspace.router)
api_router.include_router(patient_communication.router)
api_router.include_router(medication_schedule.router)
