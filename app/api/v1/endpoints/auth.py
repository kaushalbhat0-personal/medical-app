from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token
from app.schemas.auth import Token
from app.schemas.user import UserCreate, UserResponse
from app.services import auth_service

router = APIRouter(tags=["auth"])


def _build_token_payload(user) -> dict:
    payload = {
        "sub": str(user.id),
        "type": "access",
        "role": user.role.value if user.role else "admin",
        "tenant_id": None,
    }
    if user.tenant_associations:
        primary = next(
            (ta for ta in user.tenant_associations if ta.is_primary),
            user.tenant_associations[0],
        )
        payload["tenant_id"] = str(primary.tenant_id)
    return payload


@router.post("/register", response_model=Token)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> Token:
    user = auth_service.register_user(db, payload)
    access_token = create_access_token(_build_token_payload(user))
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm uses 'username' field - treat as email
    user = auth_service.authenticate_user(db, form_data.username, form_data.password)
    token_payload = _build_token_payload(user)
    access_token = create_access_token(token_payload)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": token_payload["role"],
        "tenant_id": token_payload["tenant_id"],
    }
