"""Reportes (``reports.own`` fuerza el user_id propio; ``reports.all`` ve todo).

    GET /api/reports/today
    GET /api/reports/summary?date_from&date_to&method&status&user_id&cash_session_id&category_id
    GET /api/reports/summary.pdf      (+ reports.export)
    GET /api/reports/summary.xlsx     (+ reports.export)

Período máximo 92 días (422). Días en hora de Honduras. Definiciones en
``app.services.reports``.
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request, Response

from app.core.deps import DB, require, require_any
from app.core.errors import ForbiddenError
from app.models.users import User
from app.schemas.reports import ReportParams
from app.services import reports

router = APIRouter(prefix="/reports", tags=["reports"])

Reader = Annotated[User, Depends(require_any("reports.own", "reports.all"))]
Exporter = Annotated[User, Depends(require("reports.export"))]

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _ensure_reader(user: User) -> None:
    if not user.has_any("reports.own", "reports.all"):
        raise ForbiddenError()


@router.get("/today")
def report_today(db: DB, user: Reader) -> dict[str, Any]:
    return reports.today(db, user)


@router.get("/summary")
def report_summary(db: DB, user: Reader, q: ReportParams) -> dict[str, Any]:
    return reports.summary(db, reports.resolve_filters(user, **asdict(q)))


@router.get("/summary.pdf")
def report_summary_pdf(request: Request, db: DB, user: Exporter, q: ReportParams) -> Response:
    _ensure_reader(user)
    pdf, filename = reports.summary_pdf(db, user, reports.resolve_filters(user, **asdict(q)),
                                        request)
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{filename}"'})


@router.get("/summary.xlsx")
def report_summary_xlsx(request: Request, db: DB, user: Exporter, q: ReportParams) -> Response:
    _ensure_reader(user)
    data, filename = reports.summary_xlsx(db, user, reports.resolve_filters(user, **asdict(q)),
                                          request)
    return Response(data, media_type=XLSX,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})
