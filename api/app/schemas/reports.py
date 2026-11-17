"""Report query parameters (responses are plain dicts documented in app.services.reports)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Annotated, Literal

from fastapi import Depends, Query

Method = Literal["cash", "transfer", "card", "other"]
StatusFilter = Literal["issued", "partial", "paid", "void", "without_charge"]


@dataclass(frozen=True)
class ReportQuery:
    date_from: date | None
    date_to: date | None
    method: str | None
    status: str | None
    user_id: int | None
    cash_session_id: int | None
    category_id: int | None


def _report_query(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    method: Method | None = Query(None),
    status: StatusFilter | None = Query(None),
    user_id: int | None = Query(None, ge=1),
    cash_session_id: int | None = Query(None, ge=1),
    category_id: int | None = Query(None, ge=1),
) -> ReportQuery:
    return ReportQuery(date_from, date_to, method, status, user_id, cash_session_id, category_id)


ReportParams = Annotated[ReportQuery, Depends(_report_query)]
