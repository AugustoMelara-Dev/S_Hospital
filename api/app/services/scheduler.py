"""In-process scheduler for the daily automatic backup (Honduras time).

Hook into ``app.main.lifespan``::

    from app.services.scheduler import start_scheduler, stop_scheduler

    @asynccontextmanager
    async def lifespan(app):
        get_engine()
        start_scheduler(app)
        yield
        await stop_scheduler(app)

``SHS_DAILY_BACKUP_TIME`` = ``HH:MM`` (default ``02:00``); ``off``/empty disables it.
A run is skipped if a scheduled backup already succeeded that day (e.g. after a restart).
Run a single uvicorn worker (the LAN deployment does) so only one scheduler exists.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from datetime import UTC, datetime, time, timedelta

from fastapi import FastAPI

from app.config import get_settings
from app.core.timeutil import HN_TZ, now_utc
from app.services import backups

log = logging.getLogger("shospital.scheduler")


def parse_daily_time(value: str | None) -> time | None:
    text = (value or "").strip().lower()
    if text in ("", "off", "none", "disabled", "no"):
        return None
    try:
        hh, mm = text.split(":", 1)
        return time(int(hh), int(mm))
    except ValueError:
        log.warning("SHS_DAILY_BACKUP_TIME inválido (%r); respaldo diario desactivado.", value)
        return None


def next_run_after(now: datetime, at: time) -> datetime:
    """Next UTC instant at ``at`` (Honduras wall clock) strictly after ``now``."""
    local = now.astimezone(HN_TZ)
    candidate = datetime.combine(local.date(), at, tzinfo=HN_TZ)
    if candidate <= local:
        candidate = datetime.combine(local.date() + timedelta(days=1), at, tzinfo=HN_TZ)
    return candidate.astimezone(UTC)


async def _loop(at: time) -> None:
    while True:
        target = next_run_after(now_utc(), at)
        delay = max((target - now_utc()).total_seconds(), 1.0)
        await asyncio.sleep(delay)
        try:
            await asyncio.to_thread(backups.run_scheduled_backup)
        except Exception:
            log.exception("El respaldo diario automático falló")


def start_scheduler(app: FastAPI) -> asyncio.Task[None] | None:
    """Start the daily-backup task (call inside the running event loop / lifespan)."""
    at = parse_daily_time(get_settings().daily_backup_time)
    if at is None:
        app.state.backup_scheduler = None
        return None
    task = asyncio.get_running_loop().create_task(_loop(at), name="daily-backup")
    app.state.backup_scheduler = task
    return task


async def stop_scheduler(app: FastAPI) -> None:
    task: asyncio.Task[None] | None = getattr(app.state, "backup_scheduler", None)
    if task is not None:
        task.cancel()
        # Only await it from the loop that owns it (TestClient may run several loops).
        if task.get_loop() is asyncio.get_running_loop():
            with contextlib.suppress(asyncio.CancelledError):
                await task
        app.state.backup_scheduler = None
