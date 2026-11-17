"""Shared column helpers for models.

- ``IdMixin``: ``id`` BIGINT autoincrement primary key.
- ``TimestampMixin``: ``created_at`` / ``updated_at`` (aware UTC, see ``UTCDateTime``).
- ``money()``: non-null BIGINT cents column (default 0).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.core.timeutil import now_utc
from app.db import BigId, UTCDateTime


class IdMixin:
    id: Mapped[int] = mapped_column(
        BigId, primary_key=True, autoincrement=True, sort_order=-100
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=now_utc, nullable=False, sort_order=100
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=now_utc, onupdate=now_utc, nullable=False, sort_order=101
    )


def money(*, nullable: bool = False, default: int | None = 0, **kw: Any) -> Any:
    """Integer cents column (BIGINT)."""
    if nullable:
        return mapped_column(BigInteger, nullable=True, **kw)
    return mapped_column(BigInteger, nullable=False, default=default, **kw)

