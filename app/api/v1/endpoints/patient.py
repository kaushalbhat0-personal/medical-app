from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_acting_doctor_optional,
    get_acting_doctor_optional_active,
    get_current_active_user,
    get_current_user,
    get_optional_scoped_tenant_id,
    get_optional_scoped_tenant_id_active,
    get_resolved_data_scope,
)
from app.core.data_scope import ResolvedDataScope, restrict_doctor_id_for_detail
from app.core.database import get_db
from app.models.doctor import Doctor
from app.models.user import User
from app.schemas.patient import (
    PatientCreate,
    PatientListRead,
    PatientMyDoctorRead,
    PatientRead,
    PatientUpdate,
)
from app.services import patient_service

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("/me/doctors", response_model=list[PatientMyDoctorRead])
def read_my_doctors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[PatientMyDoctorRead]:
    return patient_service.list_my_doctors(db, current_user)


@router.post("", response_model=PatientRead, status_code=201)
def create_patient(
    payload: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    acting_doctor: Doctor | None = Depends(get_acting_doctor_optional_active),
    tenant_id: UUID | None = Depends(get_optional_scoped_tenant_id_active),
) -> PatientRead:
    return patient_service.create_patient(
        db, payload, current_user, tenant_id, acting_doctor=acting_doctor
    )


@router.get("", response_model=list[PatientListRead])
def read_patients(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None, min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    acting_doctor: Doctor | None = Depends(get_acting_doctor_optional),
    tenant_id: UUID | None = Depends(get_optional_scoped_tenant_id),
    data_scope: ResolvedDataScope = Depends(get_resolved_data_scope),
) -> list[PatientListRead]:
    return patient_service.get_patients(
        db,
        current_user,
        skip=skip,
        limit=limit,
        search=search,
        tenant_id=tenant_id,
        acting_doctor=acting_doctor,
        data_scope=data_scope,
    )


@router.get("/{patient_id}", response_model=PatientRead)
def read_patient(
    patient_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    acting_doctor: Doctor | None = Depends(get_acting_doctor_optional),
    tenant_id: UUID | None = Depends(get_optional_scoped_tenant_id),
    data_scope: ResolvedDataScope = Depends(get_resolved_data_scope),
) -> PatientRead:
    patient = patient_service.get_patient_or_404(db, patient_id)
    patient_service.authorize_patient_read(
        db,
        patient,
        current_user,
        tenant_id,
        acting_doctor=acting_doctor,
        rbac_action="read_patient",
        restrict_to_doctor_id=restrict_doctor_id_for_detail(data_scope, current_user),
    )
    return patient


@router.put("/{patient_id}", response_model=PatientRead)
def update_patient(
    patient_id: UUID,
    payload: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    acting_doctor: Doctor | None = Depends(get_acting_doctor_optional),
    tenant_id: UUID | None = Depends(get_optional_scoped_tenant_id),
    data_scope: ResolvedDataScope = Depends(get_resolved_data_scope),
) -> PatientRead:
    return patient_service.update_patient(
        db,
        patient_id,
        payload,
        current_user,
        tenant_id,
        acting_doctor=acting_doctor,
        restrict_to_doctor_id=restrict_doctor_id_for_detail(data_scope, current_user),
    )


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(
    patient_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    acting_doctor: Doctor | None = Depends(get_acting_doctor_optional),
    tenant_id: UUID | None = Depends(get_optional_scoped_tenant_id),
    data_scope: ResolvedDataScope = Depends(get_resolved_data_scope),
) -> Response:
    patient_service.delete_patient(
        db,
        patient_id,
        current_user,
        tenant_id,
        acting_doctor=acting_doctor,
        restrict_to_doctor_id=restrict_doctor_id_for_detail(data_scope, current_user),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
