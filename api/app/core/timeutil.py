"""Time helpers. The DB stores UTC; business days are America/Tegucigalpa (UTC-6)."""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.config import get_settings


def _load_tz() -> tzinfo:
    try:
        return ZoneInfo(get_settings().tz)
    except (ZoneInfoNotFoundError, ValueError):
        # Honduras is UTC-6 without daylight saving time.
        return timezone(timedelta(hours=-6), "America/Tegucigalpa")


HN_TZ: tzinfo = _load_tz()


def now_utc() -> datetime:
    return datetime.now(UTC)


def to_hn(dt: datetime) -> datetime:
    """Convert to Honduras time (naive values are assumed to be UTC)."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(HN_TZ)


def iso_hn(dt: datetime | None) -> str | None:
    """ISO-8601 with Honduras offset, e.g. ``2026-11-17T10:30:00-06:00``."""
    return None if dt is None else to_hn(dt).isoformat(timespec="seconds")


def hn_today() -> date:
    return now_utc().astimezone(HN_TZ).date()


def hn_date_of(dt: datetime) -> date:
    return to_hn(dt).date()


def hn_day_bounds(day: date) -> tuple[datetime, datetime]:
    """UTC ``[start, end)`` of a Honduras calendar day."""
    start = datetime.combine(day, time.min, tzinfo=HN_TZ).astimezone(UTC)
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=HN_TZ).astimezone(UTC)
    return start, end


def hn_range_bounds(date_from: date, date_to: date) -> tuple[datetime, datetime]:
    """UTC ``[start of date_from, end of date_to)`` for an inclusive range of HN days."""
    return hn_day_bounds(date_from)[0], hn_day_bounds(date_to)[1]
