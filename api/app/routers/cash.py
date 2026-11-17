"""Caja: cajas físicas y sesiones (turnos) (SPEC §6 "Caja"), mounted under ``/api``::

    GET    /api/cash-registers                         cash.view|cash.open -> [CashRegister]
    GET    /api/cash-sessions/current                  (sesión)  -> CashSession | null
    POST   /api/cash-sessions/open            [IDEM]   cash.open -> 201 CashSession
    POST   /api/cash-sessions/{id}/close      [IDEM]   cash.close (propia) | cash.close_any
    GET    /api/cash-sessions?status&user_id&cash_register_id&date_from&date_to&difference&page
                                                       cash.view -> Page[CashSession]
    GET    /api/cash-sessions/{id}                     cash.view -> CashSession
                                                       (+reconciliation, movements)

``GET /api/cash-sessions/{id}/summary.pdf`` lives in the PDF module.
Users without ``cash.close_any``/``reports.all``/``invoices.operate_any`` only see
their own sessions.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.deps import DB, CurrentUser, require, require_any
from app.core.idempotency import Idem
from app.core.pagination import PageParams, paginate
from app.models.cash import CashSession
from app.models.users import User
from app.schemas.base import Page
from app.schemas.cash import CashCloseIn, CashOpenIn, CashRegisterOut, CashSessionOut
from app.services import cash as cash_service

router = APIRouter(tags=["cash"])

Viewer = Annotated[User, Depends(require("cash.view"))]
RegisterViewer = Annotated[User, Depends(require_any("cash.view", "cash.open"))]
Opener = Annotated[User, Depends(require("cash.open"))]
Closer = Annotated[User, Depends(require_any("cash.close", "cash.close_any"))]


def session_dict(
    db: Session, sess: CashSession, *, with_reconciliation: bool = False,
    with_movements: bool = False,
) -> dict[str, Any]:
    names = cash_service.user_names(db, {sess.user_id, sess.closed_by})
    reg = sess.cash_register
    out: dict[str, Any] = {
        "id": sess.id,
        "status": sess.status,
        "cash_register": {"id": reg.id, "code": reg.code, "name": reg.name},
        "user": {"id": sess.user_id, "name": names.get(sess.user_id, "")},
        "opening_cents": sess.opening_cents,
        "opening_notes": sess.opening_notes,
        "opened_at": sess.opened_at,
        "closed_at": sess.closed_at,
        "closed_by": (
            {"id": sess.closed_by, "name": names.get(sess.closed_by, "")}
            if sess.closed_by is not None else None
        ),
        "counted_cents": sess.counted_cents,
        "expected_cash_cents": sess.expected_cash_cents,
        "difference_cents": sess.difference_cents,
        "closing_notes": sess.closing_notes,
        "closing_breakdown": sess.closing_breakdown,
        "method_totals": sess.method_totals,
        "payments_count": sess.payments_count,
        "payments_total_cents": sess.payments_total_cents,
    }
    if with_reconciliation:
        out["reconciliation"] = cash_service.reconciliation(db, sess)
    if with_movements:
        out["movements"] = cash_service.movements(db, sess)
    return out


@router.get("/cash-registers", response_model=list[CashRegisterOut])
def list_registers(db: DB, user: RegisterViewer) -> list[CashRegisterOut]:
    return [CashRegisterOut.model_validate(r) for r in cash_service.list_registers(db)]


@router.get("/cash-sessions/current", response_model=CashSessionOut | None)
def current(db: DB, user: CurrentUser) -> CashSessionOut | None:
    sess = cash_service.own_open_session(db, user)
    if sess is None:
        return None
    return CashSessionOut.model_validate(session_dict(db, sess, with_reconciliation=True))


@router.post("/cash-sessions/open", status_code=201, response_model=CashSessionOut)
def open_session(
    data: CashOpenIn, request: Request, db: DB, user: Opener, idem: Idem
) -> Response:
    sess = cash_service.open_session(
        db, user, register_id=data.cash_register_id, opening_cents=data.opening_cents,
        notes=data.notes, request=request,
    )
    out = CashSessionOut.model_validate(session_dict(db, sess, with_reconciliation=True))
    return idem.respond(201, out)


@router.post("/cash-sessions/{session_id}/close", response_model=CashSessionOut)
def close_session(
    session_id: int, data: CashCloseIn, request: Request, db: DB, user: Closer, idem: Idem
) -> Response:
    sess = cash_service.close_session(
        db, user, session_id, counted_cents=data.counted_cents, notes=data.notes,
        breakdown=data.breakdown.model_dump() if data.breakdown is not None else None,
        request=request,
    )
    out = CashSessionOut.model_validate(
        session_dict(db, sess, with_reconciliation=True, with_movements=True)
    )
    return idem.respond(200, out)


@router.get("/cash-sessions", response_model=Page[CashSessionOut])
def list_sessions(
    db: DB,
    user: Viewer,
    params: PageParams,
    status: Literal["open", "closed"] | None = None,
    user_id: int | None = None,
    cash_register_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    difference: Literal["all", "balanced", "shortage", "overage"] = "all",
) -> dict[str, Any]:
    stmt = cash_service.list_sessions_stmt(
        user, status=status, user_id=user_id, cash_register_id=cash_register_id,
        date_from=date_from, date_to=date_to, difference=difference,
    )
    page = paginate(db, stmt, params)
    page["items"] = [session_dict(db, s) for s in page["items"]]
    return page


@router.get("/cash-sessions/{session_id}", response_model=CashSessionOut)
def get_session(session_id: int, db: DB, user: Viewer) -> CashSessionOut:
    sess = cash_service.get_session_for(db, user, session_id)
    return CashSessionOut.model_validate(
        session_dict(db, sess, with_reconciliation=True, with_movements=True)
    )
