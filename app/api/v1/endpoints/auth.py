from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token
from app.schemas.auth import Token
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.services import auth_service

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=Token)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> Token:
    user = auth_service.register_user(db, payload)
    access_token = create_access_token({"sub": str(user.id), "type": "access"})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> Token:
    user = auth_service.authenticate_user(db, payload.email, payload.password)
    access_token = create_access_token({"sub": str(user.id), "type": "access"})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )
