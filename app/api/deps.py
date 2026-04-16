from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.api.http_exceptions import (
    inactive_user_exception,
    unauthorized_credentials_exception,
)
from app.core.database import get_db
from app.core.security import decode_access_token
from app.crud import crud_user
from app.models.user import User

http_bearer = HTTPBearer(auto_error=False)


def _user_id_from_access_token(token: str) -> UUID:
    payload = decode_access_token(token)
    if payload is None:
        raise unauthorized_credentials_exception()
    if payload.get("type") != "access":
        raise unauthorized_credentials_exception()
    sub = payload.get("sub")
    if sub is None or not isinstance(sub, str):
        raise unauthorized_credentials_exception()
    try:
        return UUID(sub)
    except ValueError:
        raise unauthorized_credentials_exception()


def get_current_user(
    db: Session = Depends(get_db),
    bearer: HTTPAuthorizationCredentials | None = Depends(http_bearer),
) -> User:
    if bearer is None or not bearer.credentials:
        raise unauthorized_credentials_exception()
    token = bearer.credentials
    user_id = _user_id_from_access_token(token)
    user = crud_user.get_user(db, user_id)
    if user is None:
        raise unauthorized_credentials_exception()
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise inactive_user_exception()
    return current_user
