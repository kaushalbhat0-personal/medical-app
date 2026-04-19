import logging
from sqlalchemy.orm import Session
from app.core.security import hash_password, verify_password
from app.crud import crud_user
from app.models.user import User
from app.schemas.user import UserCreate
from app.services.exceptions import AuthenticationError, ConflictError

logger = logging.getLogger(__name__)


def register_user(db: Session, user_in: UserCreate) -> User:
    if crud_user.get_user_by_email(db, user_in.email):
        raise ConflictError("Email already registered")
    hashed = hash_password(user_in.password)
    return crud_user.create_user(db, {"email": user_in.email, "hashed_password": hashed})


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