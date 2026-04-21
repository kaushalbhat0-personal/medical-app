import logging
from sqlalchemy.orm import Session
from app.core.security import hash_password, verify_password
from app.crud import crud_patient, crud_user
from app.models.user import User
from app.schemas.user import UserCreate
from app.services import doctor_service
from app.services.exceptions import AuthenticationError, ConflictError, ValidationError

logger = logging.getLogger(__name__)


def register_user(db: Session, user_in: UserCreate) -> User:
    hashed = hash_password(user_in.password)

    with db.begin():
        if crud_user.get_user_by_email(db, user_in.email):
            raise ConflictError("Email already registered")
        user = crud_user.create_user_tx(
            db,
            {
                "email": user_in.email,
                "hashed_password": hashed,
                "role": user_in.role,
            },
        )

        if user.role.value == "doctor":
            if user_in.doctor_profile is None:
                raise ConflictError("Doctor profile data required for doctor role")
            doctor_service.create_doctor(
                db,
                user_in.doctor_profile,
                tenant_id=None,
                user_id=user.id,
                current_user=None,
            )

        if user.role.value == "patient":
            if user_in.patient_profile is None:
                raise ConflictError("Patient profile data required for patient role")
            patient_data = user_in.patient_profile.model_dump()
            # Patients are global users; no strict tenant ownership.
            patient_data["tenant_id"] = None
            patient_data["created_by"] = user.id
            patient_data["user_id"] = user.id
            crud_patient.create_patient_tx(db, patient_data)

    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    # Normalize email to lowercase for case-insensitive matching
    email_normalized = email.lower().strip()
    logger.info(f"[AUTH] Attempting login for: {email_normalized}")

    user = crud_user.get_user_by_email(db, email_normalized)
    if user is None:
        logger.warning(f"[AUTH] User not found: {email_normalized}")
        raise AuthenticationError("Incorrect email or password")

    logger.info(f"[AUTH] User found: {user.email}, active={user.is_active}")

    if not user.is_active:
        logger.warning(f"[AUTH] User inactive: {email_normalized}")
        raise AuthenticationError("Incorrect email or password")

    password_valid = verify_password(password, user.hashed_password)
    logger.info(f"[AUTH] Password verification: {password_valid}")

    if not password_valid:
        logger.warning(f"[AUTH] Invalid password for: {email_normalized}")
        raise AuthenticationError("Incorrect email or password")

    logger.info(f"[AUTH] Login successful: {email_normalized}")
    return user


def reset_password(db: Session, user: User, old_password: str, new_password: str) -> User:
    if not verify_password(old_password, user.hashed_password):
        raise ValidationError("Current password is incorrect")
    if verify_password(new_password, user.hashed_password):
        raise ValidationError("New password must be different from your current password")
    user.hashed_password = hash_password(new_password)
    user.force_password_reset = False
    db.add(user)
    db.commit()
    db.refresh(user)
    return user