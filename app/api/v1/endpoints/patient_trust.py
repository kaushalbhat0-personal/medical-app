"""
patient_trust.py — Trust & Family Foundation API endpoints.

Lightweight additive endpoints for emergency profile, trusted contacts,
dependent linkage, and caregiver access metadata.

ALLOWED:
- Lightweight profile metadata CRUD
- Trusted contact metadata CRUD
- Dependent linkage foundations (read-only for now)
- Nullable additive fields

NOT ALLOWED:
- Auth bypass systems
- Permission escalation systems
- Shadow patient tables
- Duplicate medical records
- Emergency override systems
"""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.patient_trust import (
    EmergencyProfileRead,
    EmergencyProfileUpdate,
    TrustedContactCreate,
    TrustedContactRead,
    TrustedContactUpdate,
    DependentProfileRead,
    CaregiverAccessRead,
    HealthSummaryMetadataRead,
    PatientTrustAggregate,
)
from app.services import patient_trust_service

router = APIRouter(
    prefix="/patients/me/trust",
    tags=["patient-trust"],
)


# ═════════════════════════════════════════════════════════════════════════════
# Trust Aggregate
# ═════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=PatientTrustAggregate)
def get_trust_aggregate(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> PatientTrustAggregate:
    """Get the complete trust & family aggregate for the current patient."""
    return patient_trust_service.get_trust_aggregate(db, current_user)


# ═════════════════════════════════════════════════════════════════════════════
# Emergency Profile
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/emergency-profile", response_model=EmergencyProfileRead | None)
def get_emergency_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> EmergencyProfileRead | None:
    """Get the emergency profile for the current patient."""
    return patient_trust_service.get_emergency_profile(db, current_user)


@router.put("/emergency-profile", response_model=EmergencyProfileRead)
def update_emergency_profile(
    payload: EmergencyProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> EmergencyProfileRead:
    """Update the emergency profile for the current patient."""
    return patient_trust_service.update_emergency_profile(db, payload, current_user)


# ═════════════════════════════════════════════════════════════════════════════
# Trusted Contacts
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/contacts", response_model=list[TrustedContactRead])
def get_trusted_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[TrustedContactRead]:
    """Get all trusted contacts for the current patient."""
    return patient_trust_service.get_trusted_contacts(db, current_user)


@router.post("/contacts", response_model=TrustedContactRead, status_code=status.HTTP_201_CREATED)
def create_trusted_contact(
    payload: TrustedContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TrustedContactRead:
    """Create a new trusted contact."""
    return patient_trust_service.create_trusted_contact(db, payload, current_user)


@router.put("/contacts/{contact_id}", response_model=TrustedContactRead)
def update_trusted_contact(
    contact_id: UUID,
    payload: TrustedContactUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TrustedContactRead:
    """Update a trusted contact."""
    return patient_trust_service.update_trusted_contact(db, contact_id, payload, current_user)


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trusted_contact(
    contact_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Delete a trusted contact."""
    return patient_trust_service.delete_trusted_contact(db, contact_id, current_user)


# ═════════════════════════════════════════════════════════════════════════════
# Dependents
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/dependents", response_model=list[DependentProfileRead])
def get_dependents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[DependentProfileRead]:
    """Get all dependents linked to the current patient."""
    return patient_trust_service.get_dependents(db, current_user)


# ═════════════════════════════════════════════════════════════════════════════
# Caregivers
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/caregivers", response_model=list[CaregiverAccessRead])
def get_caregivers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[CaregiverAccessRead]:
    """Get all caregivers who have access to this patient's care."""
    return patient_trust_service.get_caregivers(db, current_user)


# ═════════════════════════════════════════════════════════════════════════════
# Health Summary
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/health-summary", response_model=HealthSummaryMetadataRead)
def get_health_summary_metadata(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> HealthSummaryMetadataRead:
    """Get metadata for the downloadable health summary."""
    return patient_trust_service.get_health_summary_metadata(db, current_user)
