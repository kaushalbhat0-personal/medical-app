from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.tenant import TenantType


class TenantAdminCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class TenantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: TenantType = TenantType.hospital
    admin: TenantAdminCreate
    address: str | None = Field(default=None, max_length=500)
    phone: str | None = Field(default=None, max_length=50)
    slug: str | None = Field(
        default=None,
        max_length=255,
        description="URL-safe identifier (e.g. apollo-hospital-pune). Stored lowercased.",
    )


class TenantPublicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str | None = None
    type: str
    is_active: bool
    address: str | None = None
    phone: str | None = None
    created_at: datetime
    admin_email: str | None = None

