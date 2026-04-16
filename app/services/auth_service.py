from sqlalchemy.orm import Session
from app.core.security import hash_password, verify_password
from app.crud import crud_user
from app.models.user import User
from app.schemas.user import UserCreate
from app.services.exceptions import AuthenticationError, ConflictError


def register_user(db: Session, user_in: UserCreate) -> User:
    if crud_user.get_user_by_email(db, user_in.email):
        raise ConflictError("Email already registered")
    hashed = hash_password(user_in.password)
    return crud_user.create_user(db, {"email": user_in.email, "hashed_password": hashed})


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = crud_user.get_user_by_email(db, email)
    if user is None:
        raise AuthenticationError("Incorrect email or password")
    if not user.is_active:
        raise AuthenticationError("Incorrect email or password")
    if not verify_password(password, user.hashed_password):
        raise AuthenticationError("Incorrect email or password")
    return user