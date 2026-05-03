from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class IntegritySeverity(str, Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"


class IntegrityIssue(BaseModel):
    category: str = Field(
        ...,
        description="appointment_invariant | billing_alignment | duplicate_bill | inventory_movement",
    )
    severity: IntegritySeverity = Field(
        default=IntegritySeverity.CRITICAL,
        description="Gate CI/CD on CRITICAL; WARNING is actionable but non-blocking.",
    )
    #: Aggregated bucket for ``samples`` (e.g. tenant_mismatch vs raw category).
    sample_key: str = Field(default="", description="Key used in IntegrityScanResponse.samples")
    detail: str
    resource_id: str | None = None
    tenant_id: str | None = None


class IntegrityScanResponse(BaseModel):
    """Integrity scan gate: use ``critical_count`` for deploy failure; summarize with ``samples``."""

    status: Literal["ok", "issues"] = Field(
        ...,
        description="ok when critical_count is zero (warnings allowed)",
    )
    scanned_at: datetime
    tenant_id: str | None = Field(
        None,
        description="Organization scoped when set; omitted when all_tenants scan",
    )
    all_tenants: bool = False
    appointments_checked: int = 0
    critical_count: int = 0
    warning_count: int = 0
    samples: dict[str, list[str]] = Field(
        default_factory=dict,
        description="Category-style keys to example resource IDs (usually appointment UUID strings)",
    )
    issues: list[IntegrityIssue] = Field(default_factory=list)
    #: Time of the most recent scan in this scope with ``critical_count == 0`` (persisted).
    last_successful_scan_at: datetime | None = Field(
        default=None,
        description="UTC timestamp of the last scan for this scope with no critical issues",
    )
    ok: bool = Field(
        default=True,
        description="Backward compat: True when critical_count == 0 (warnings may still exist)",
    )
