from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.integrity_scan_state import IntegrityScanState


def get_last_successful_scan_at(db: Session, *, scope_key: str) -> datetime | None:
    row = db.get(IntegrityScanState, scope_key)
    return row.last_successful_scan_at if row else None


def upsert_last_successful_scan_at(
    db: Session,
    *,
    scope_key: str,
    scanned_at: datetime,
) -> None:
    row = db.get(IntegrityScanState, scope_key)
    if row is None:
        db.add(
            IntegrityScanState(
                scope_key=scope_key,
                last_successful_scan_at=scanned_at,
            )
        )
    else:
        row.last_successful_scan_at = scanned_at
    db.flush()
