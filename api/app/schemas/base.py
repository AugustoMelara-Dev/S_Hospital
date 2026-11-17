"""Shared pydantic bases and types.

- ``InputSchema``: request bodies (unknown fields rejected, strings stripped).
- ``OutputSchema``: responses built from ORM objects (``from_attributes``).
- ``HNDateTime``: datetime serialized as ISO-8601 with Honduras offset.
- ``Page[T]``: ``{"items": [...], "page", "per_page", "total"}``.
- ``Reason``: motive text required for sensitive changes (>= 5 chars).
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer

from app.core.timeutil import iso_hn


class InputSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class OutputSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


HNDateTime = Annotated[datetime, PlainSerializer(iso_hn, return_type=str)]

Reason = Annotated[str, Field(min_length=5, max_length=500)]


class Page[T](BaseModel):
    items: list[T]
    page: int
    per_page: int
    total: int
