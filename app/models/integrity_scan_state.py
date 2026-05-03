"""Persistence for integrity scan observability (last healthy snapshot per scope)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class IntegrityScanState(Base):
    """One row per scan scope: when ``critical_count`` last reached zero."""

    __tablename__ = "integrity_scan_state"

    #: ``all`` for cross-tenant scans; ``tenant:<uuid>`` for org-scoped scans.
    scope_key: Mapped[str] = mapped_column(String(96), primary_key=True)
    last_successful_scan_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
