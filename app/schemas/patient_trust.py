"""
patient_trust.py — Trust & Family Foundation schemas.

Lightweight additive schemas for emergency profile, trusted contacts,
dependent linkage, and caregiver access metadata.

ALLOWED:
- Lightweight profile metadata
- Trusted contact metadata
- Dependent linkage foundations
- Nullable additive fields

NOT ALLOWED:
- Auth bypass systems
- Permission escalation systems
- Shadow patient tables
- Duplicate medical records
- Emergency override systems
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


# ═════════════════════════════════════════════════════════════════════════════
# Emergency Profile
# ═════════════════════════════════════════════════════════════════════════════

class EmergencyProfileRead(BaseModel):
    """Patient-visible emergency information. Read-only aggregate."""

    model_config = ConfigDict(from_attributes=True)

    blood_group: str | None = None
    allergies: list[str] = []
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relation: str | None = None
    chronic_conditions: str | None = None
    active_medications_summary: str | None = None
    primary_doctor_name: str | None = None
    primary_doctor_specialization: str | None = None
    insurance_provider: str | None = None
    insurance_id: str | None = None
    updated_at: datetime | None = None


class EmergencyProfileUpdate(BaseModel):
    """Mutable fields for emergency profile."""

    blood_group: str | None = None
    allergies: list[str] | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relation: str | None = None
    chronic_conditions: str | None = None
    insurance_provider: str | None = None
    insurance_id: str | None = None


# ═════════════════════════════════════════════════════════════════════════════
# Trusted Contacts
# ═════════════════════════════════════════════════════════════════════════════

class TrustedContactRead(BaseModel):
    """A person the patient trusts with their care information."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    relationship: str
    phone: str | None = None
    email: str | None = None
    communication_preference: str = "none"
    is_emergency_contact: bool = False
    shared_items: list[str] = []
    created_at: datetime | None = None


class TrustedContactCreate(BaseModel):
    name: str
    relationship: str
    phone: str | None = None
    email: str | None = None
    communication_preference: str = "none"
    is_emergency_contact: bool = False
    shared_items: list[str] = []


class TrustedContactUpdate(BaseModel):
    name: str | None = None
    relationship: str | None = None
    phone: str | None = None
    email: str | None = None
    communication_preference: str | None = None
    is_emergency_contact: bool | None = None
    shared_items: list[str] | None = None


# ═════════════════════════════════════════════════════════════════════════════
# Dependent Profile
# ═════════════════════════════════════════════════════════════════════════════

class DependentAppointmentBrief(BaseModel):
    """Minimal appointment info for dependent display."""

    id: UUID
    appointment_time: datetime
    doctor_name: str
    doctor_specialization: str | None = None
    clinic_name: str | None = None


class DependentProfileRead(BaseModel):
    """A family member whose care is managed by this patient."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    relationship: str
    age: int | None = None
    gender: str | None = None
    upcoming_appointments: list[DependentAppointmentBrief] = []
    shared_medication_count: int = 0


# ═════════════════════════════════════════════════════════════════════════════
# Caregiver Access
# ═════════════════════════════════════════════════════════════════════════════

class CaregiverAccessRead(BaseModel):
    """A person who has access to this patient's care information."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    relationship: str
    phone: str | None = None
    email: str | None = None
    access_granted_at: datetime | None = None
    trust_level: str = "view_only"


# ═════════════════════════════════════════════════════════════════════════════
# Health Summary Metadata
# ═════════════════════════════════════════════════════════════════════════════

class HealthSummaryMetadataRead(BaseModel):
    """Metadata for the downloadable health summary."""

    encounter_count: int = 0
    active_medication_count: int = 0
    document_count: int = 0
    has_emergency_profile: bool = False
    last_encounter_date: datetime | None = None
    generated_at: datetime | None = None


# ═════════════════════════════════════════════════════════════════════════════
# Trust Aggregate
# ═════════════════════════════════════════════════════════════════════════════

class PatientTrustAggregate(BaseModel):
    """Aggregate of all trust & family data for the current patient."""

    emergency_profile: EmergencyProfileRead | None = None
    trusted_contacts: list[TrustedContactRead] = []
    dependents: list[DependentProfileRead] = []
    caregivers: list[CaregiverAccessRead] = []
    health_summary: HealthSummaryMetadataRead | None = None
