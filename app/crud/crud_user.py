from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def get_user(db: Session, user_id: UUID) -> User | None:
    return db.get(User, user_id)


def get_user_by_email(db: Session, email: str) -> User | None:
    stmt = select(User).where(User.email == email)
    return db.scalars(stmt).first()


def create_user(db: Session, user_data: dict[str, Any]) -> User:
    user = User(
        email=user_data["email"],
        hashed_password=user_data["hashed_password"],
    )
    if "role" in user_data and user_data["role"] is not None:
        user.role = user_data["role"]
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
