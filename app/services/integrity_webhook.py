"""Optional webhook alerts for integrity / idempotency drift (same env as integrity_scan_gate)."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


def maybe_post_integrity_alert_webhook(body: dict[str, Any]) -> None:
    """POST JSON to ``INTEGRITY_ALERT_WEBHOOK_URL`` when set; failures are non-blocking."""
    url = settings.INTEGRITY_ALERT_WEBHOOK_URL
    if not url or not str(url).strip():
        return
    data = json.dumps(body, default=str).encode("utf-8")
    req = urllib.request.Request(
        str(url).strip(),
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
    except urllib.error.HTTPError:
        logger.warning("integrity alert webhook POST failed (HTTP)")
    except urllib.error.URLError as exc:
        logger.warning("integrity alert webhook POST failed: %s", exc)
