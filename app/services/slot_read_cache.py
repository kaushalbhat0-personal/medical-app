"""Pluggable cache for doctor slot reads (in-process default; Redis can replace via backend hook)."""

from __future__ import annotations

import threading
import time as time_module
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.schemas.doctor import DoctorSlotRead


class SlotReadCacheBackend(ABC):
    """Abstract slot list cache. Implementations must be thread-safe if shared across workers."""

    @abstractmethod
    def get(self, doctor_id_str: str, on_date_iso: str) -> list["DoctorSlotRead"] | None:
        """Return a copy of cached slots, or None if missing/expired."""

    @abstractmethod
    def set(self, doctor_id_str: str, on_date_iso: str, slots: list["DoctorSlotRead"], ttl_sec: float) -> None:
        """Store slots until monotonic TTL expires."""

    @abstractmethod
    def invalidate_date(self, doctor_id_str: str, on_date_iso: str) -> None:
        """Drop one doctor+date key."""

    @abstractmethod
    def invalidate_doctor(self, doctor_id_str: str) -> None:
        """Drop all cached dates for a doctor."""


class InMemorySlotReadCache(SlotReadCacheBackend):
    """Thread-safe in-process LRU-style dict (TTL per entry). Suitable for single-worker deployments."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._data: dict[tuple[str, str], tuple[float, list["DoctorSlotRead"]]] = {}

    def get(self, doctor_id_str: str, on_date_iso: str) -> list["DoctorSlotRead"] | None:
        key = (doctor_id_str, on_date_iso)
        now_m = time_module.monotonic()
        with self._lock:
            hit = self._data.get(key)
            if hit is None:
                return None
            expires_at, cached = hit
            if now_m >= expires_at:
                self._data.pop(key, None)
                return None
            return list(cached)

    def set(self, doctor_id_str: str, on_date_iso: str, slots: list["DoctorSlotRead"], ttl_sec: float) -> None:
        key = (doctor_id_str, on_date_iso)
        with self._lock:
            self._data[key] = (time_module.monotonic() + ttl_sec, list(slots))

    def invalidate_date(self, doctor_id_str: str, on_date_iso: str) -> None:
        key = (doctor_id_str, on_date_iso)
        with self._lock:
            self._data.pop(key, None)

    def invalidate_doctor(self, doctor_id_str: str) -> None:
        with self._lock:
            for k in list(self._data.keys()):
                if k[0] == doctor_id_str:
                    del self._data[k]


_default_cache: InMemorySlotReadCache | None = None
_default_cache_lock = threading.Lock()


def get_default_in_memory_slot_cache() -> InMemorySlotReadCache:
    global _default_cache
    with _default_cache_lock:
        if _default_cache is None:
            _default_cache = InMemorySlotReadCache()
        return _default_cache
