"""Cash sessions (shifts), movements and reconciliation (SPEC §5 rule 7).

- One open session per register and per user (unique-null markers, 409 on conflict).
- Expected cash = opening + cash payments − voided cash payments (movement based).
- Close is blocked by ``issued|partial`` invoices of the session or paid invoices
  without an issued institutional receipt. ``difference = counted − expected``;
  a non-zero difference requires a note (≥5 chars). The optional denomination
  breakdown must add up to ``counted_cents``. A closed session is immutable.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import Request
from sqlalchemy import Select, and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.errors import (
    BusinessRuleError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationFailedError,
)
from app.core.timeutil import hn_range_bounds, now_utc
from app.models.billing import (
    INVOICE_ISSUED,
    INVOICE_PAID,
    INVOICE_PARTIAL,
    PAYMENT_METHODS,
    PAYMENT_POSTED,
    Invoice,
    Payment,
)
from app.models.cash import CASH_OPEN, CashMovement, CashRegister, CashSession
from app.models.receipts import RECEIPT_ISSUED, InstitutionalReceipt
from app.models.users import User

DENOMINATIONS = ("500", "200", "100", "50", "20", "10", "5", "2", "1")
MOVEMENT_OPENING = "opening"
MOVEMENT_PAYMENT = "payment"
MOVEMENT_PAYMENT_VOID = "payment_void"
MOVEMENT_CLOSING = "closing"

CASH_REQUIRED_MESSAGE = "Abra caja antes de emitir y cobrar."


# --- lookups ---------------------------------------------------------------

def own_open_session(db: Session, user: User) -> CashSession | None:
    return db.scalar(
        select(CashSession).where(CashSession.user_id == user.id, CashSession.status == CASH_OPEN)
    )


def require_own_open_session(db: Session, user: User) -> CashSession:
    sess = own_open_session(db, user)
    if sess is None:
        raise BusinessRuleError("cash_session_required", CASH_REQUIRED_MESSAGE)
    return sess


def can_view_any_sessions(user: User) -> bool:
    return user.has_any("cash.close_any", "reports.all", "invoices.operate_any")


def get_session_for(db: Session, user: User, session_id: int) -> CashSession:
    sess = db.get(CashSession, session_id)
    if sess is None:
        raise NotFoundError("cash_session_not_found", "La sesión de caja no existe.")
    if sess.user_id != user.id and not can_view_any_sessions(user):
        raise ForbiddenError("forbidden", "Solo puede consultar sus propias sesiones de caja.")
    return sess


def list_registers(db: Session) -> list[CashRegister]:
    return list(db.scalars(select(CashRegister).order_by(CashRegister.id)))


# --- open ------------------------------------------------------------------

def _resolve_register(db: Session, register_id: int | None) -> CashRegister:
    if register_id is None:
        reg = db.scalar(select(CashRegister).where(CashRegister.code == "principal"))
        if reg is None:
            reg = db.scalar(
                select(CashRegister).where(CashRegister.active.is_(True)).order_by(CashRegister.id)
            )
    else:
        reg = db.get(CashRegister, register_id)
    if reg is None:
        raise NotFoundError("cash_register_not_found", "La caja física no existe.")
    if not reg.active:
        raise BusinessRuleError("cash_register_inactive", "La caja física está desactivada.")
    return reg


def open_session(
    db: Session,
    user: User,
    *,
    register_id: int | None,
    opening_cents: int,
    notes: str,
    request: Request | None = None,
) -> CashSession:
    reg = _resolve_register(db, register_id)
    if own_open_session(db, user) is not None:
        raise ConflictError("cash_session_already_open", "Usted ya tiene una caja abierta.")
    busy = db.scalar(
        select(CashSession).where(
            CashSession.cash_register_id == reg.id, CashSession.status == CASH_OPEN
        )
    )
    if busy is not None:
        raise ConflictError(
            "cash_register_busy",
            f"La caja «{reg.name}» ya tiene una sesión abierta por otro usuario.",
        )
    now = now_utc()
    sess = CashSession(
        cash_register_id=reg.id,
        user_id=user.id,
        opening_cents=opening_cents,
        opening_notes=notes,
        opened_at=now,
    )
    sess.mark_open()
    db.add(sess)
    try:
        db.flush()
    except IntegrityError as exc:  # concurrent open of the same register/user
        db.rollback()
        raise ConflictError(
            "cash_session_already_open", "La caja o el usuario ya tienen una sesión abierta."
        ) from exc
    db.add(CashMovement(
        cash_session_id=sess.id, user_id=user.id, type=MOVEMENT_OPENING, method="cash",
        amount_cents=opening_cents, notes=notes, occurred_at=now,
    ))
    audit(db, user, "cash.opened", entity=sess,
          new={"cash_register_id": reg.id, "opening_cents": opening_cents}, request=request)
    db.flush()
    return sess


# --- reconciliation --------------------------------------------------------

def _method_totals(db: Session, session_id: int) -> dict[str, int]:
    totals = dict.fromkeys(PAYMENT_METHODS, 0)
    rows = db.execute(
        select(CashMovement.method, func.coalesce(func.sum(CashMovement.amount_cents), 0))
        .where(
            CashMovement.cash_session_id == session_id,
            CashMovement.type.in_((MOVEMENT_PAYMENT, MOVEMENT_PAYMENT_VOID)),
        )
        .group_by(CashMovement.method)
    ).all()
    for method, amount in rows:
        if method in totals:
            totals[method] = int(amount)
    return totals


def reconciliation(db: Session, sess: CashSession) -> dict[str, Any]:
    method_totals = _method_totals(db, sess.id)
    expected = sess.opening_cents + method_totals["cash"]
    count, total = db.execute(
        select(func.count(Payment.id), func.coalesce(func.sum(Payment.amount_cents), 0)).where(
            Payment.cash_session_id == sess.id, Payment.status == PAYMENT_POSTED
        )
    ).one()
    pending_count, pending_cents = db.execute(
        select(func.count(Invoice.id), func.coalesce(func.sum(Invoice.balance_cents), 0)).where(
            Invoice.cash_session_id == sess.id,
            Invoice.status.in_((INVOICE_ISSUED, INVOICE_PARTIAL)),
        )
    ).one()
    missing = db.scalar(
        select(func.count(Invoice.id))
        .outerjoin(
            InstitutionalReceipt,
            and_(
                InstitutionalReceipt.invoice_id == Invoice.id,
                InstitutionalReceipt.status == RECEIPT_ISSUED,
            ),
        )
        .where(
            Invoice.cash_session_id == sess.id,
            Invoice.status == INVOICE_PAID,
            InstitutionalReceipt.id.is_(None),
        )
    ) or 0
    blockers: list[dict[str, Any]] = []
    if pending_count:
        blockers.append({
            "code": "pending_invoices",
            "message": "Hay facturas pendientes de cobro en este turno. Cóbrelas o anúlelas.",
            "count": int(pending_count),
        })
    if missing:
        blockers.append({
            "code": "missing_receipts",
            "message": "Hay facturas pagadas sin recibo institucional emitido.",
            "count": int(missing),
        })
    return {
        "opening_cents": sess.opening_cents,
        "expected_cash_cents": expected,
        "method_totals": method_totals,
        "payments_count": int(count),
        "payments_total_cents": int(total),
        "pending_count": int(pending_count),
        "pending_cents": int(pending_cents),
        "missing_receipts_count": int(missing),
        "can_close": sess.is_open and not blockers,
        "blockers": blockers,
    }


# --- close -----------------------------------------------------------------

def _validate_breakdown(breakdown: dict[str, Any], counted_cents: int) -> dict[str, Any]:
    bills_in: dict[str, int] = breakdown.get("bills") or {}
    coins = int(breakdown.get("coins_cents") or 0)
    unknown = [k for k in bills_in if k not in DENOMINATIONS]
    if unknown:
        raise ValidationFailedError(
            fields={"breakdown": f"Denominación no válida: {', '.join(sorted(unknown))}."}
        )
    bills = {k: int(bills_in.get(k, 0)) for k in DENOMINATIONS}
    total = sum(int(k) * 100 * n for k, n in bills.items()) + coins
    if total != counted_cents:
        raise ValidationFailedError(
            "breakdown_mismatch",
            "El desglose por denominaciones no coincide con el total contado.",
            fields={"breakdown": "El desglose debe sumar el total contado."},
        )
    return {"bills": bills, "coins_cents": coins, "total_cents": total}


def close_session(
    db: Session,
    user: User,
    session_id: int,
    *,
    counted_cents: int,
    notes: str,
    breakdown: dict[str, Any] | None,
    request: Request | None = None,
) -> CashSession:
    sess = db.scalar(
        select(CashSession).where(CashSession.id == session_id).with_for_update()
    )
    if sess is None:
        raise NotFoundError("cash_session_not_found", "La sesión de caja no existe.")
    own = sess.user_id == user.id
    if not (user.has_permission("cash.close_any") or (own and user.has_permission("cash.close"))):
        raise ForbiddenError(
            "forbidden", "No tiene permiso para cerrar la caja de otro usuario."
        )
    if not sess.is_open:
        raise ConflictError("cash_session_closed", "La sesión de caja ya está cerrada.")
    rec = reconciliation(db, sess)
    if rec["blockers"]:
        raise BusinessRuleError(
            "cash_close_blocked",
            " ".join(b["message"] for b in rec["blockers"]),
        )
    expected = rec["expected_cash_cents"]
    difference = counted_cents - expected
    if difference != 0 and len(notes.strip()) < 5:
        raise ValidationFailedError(
            "closing_note_required",
            "Con diferencia en el arqueo, la nota de cierre es obligatoria (mínimo 5 caracteres).",
            fields={"notes": "Explique la diferencia (mínimo 5 caracteres)."},
        )
    stored_breakdown = (
        _validate_breakdown(breakdown, counted_cents) if breakdown is not None else None
    )
    now = now_utc()
    sess.counted_cents = counted_cents
    sess.expected_cash_cents = expected
    sess.difference_cents = difference
    sess.closing_notes = notes
    sess.closing_breakdown = stored_breakdown
    sess.method_totals = rec["method_totals"]
    sess.payments_count = rec["payments_count"]
    sess.payments_total_cents = rec["payments_total_cents"]
    sess.closed_at = now
    sess.closed_by = user.id
    sess.mark_closed()
    db.add(CashMovement(
        cash_session_id=sess.id, user_id=user.id, type=MOVEMENT_CLOSING, method="cash",
        amount_cents=counted_cents, notes=notes, occurred_at=now,
    ))
    audit(db, user, "cash.closed", entity=sess, reason=notes or None, new={
        "counted_cents": counted_cents, "expected_cash_cents": expected,
        "difference_cents": difference, "own": own,
    }, request=request)
    db.flush()
    return sess


# --- listing ---------------------------------------------------------------

def list_sessions_stmt(
    user: User,
    *,
    status: str | None,
    user_id: int | None,
    cash_register_id: int | None,
    date_from: date | None,
    date_to: date | None,
    difference: str,
) -> Select[Any]:
    stmt = select(CashSession)
    if not can_view_any_sessions(user):
        stmt = stmt.where(CashSession.user_id == user.id)
    elif user_id is not None:
        stmt = stmt.where(CashSession.user_id == user_id)
    if status:
        stmt = stmt.where(CashSession.status == status)
    if cash_register_id is not None:
        stmt = stmt.where(CashSession.cash_register_id == cash_register_id)
    if date_from or date_to:
        start, end = hn_range_bounds(date_from or date(2000, 1, 1), date_to or date(2999, 12, 31))
        stmt = stmt.where(CashSession.opened_at >= start, CashSession.opened_at < end)
    if difference == "balanced":
        stmt = stmt.where(CashSession.difference_cents == 0)
    elif difference == "shortage":
        stmt = stmt.where(CashSession.difference_cents < 0)
    elif difference == "overage":
        stmt = stmt.where(CashSession.difference_cents > 0)
    return stmt.order_by(CashSession.opened_at.desc(), CashSession.id.desc())


def movements(db: Session, sess: CashSession) -> list[dict[str, Any]]:
    rows = db.execute(
        select(CashMovement, Payment, Invoice.number)
        .outerjoin(Payment, Payment.id == CashMovement.payment_id)
        .outerjoin(Invoice, Invoice.id == Payment.invoice_id)
        .where(CashMovement.cash_session_id == sess.id)
        .order_by(CashMovement.occurred_at, CashMovement.id)
    ).all()
    out: list[dict[str, Any]] = []
    for mov, pay, number in rows:
        out.append({
            "id": mov.id,
            "type": mov.type,
            "method": mov.method,
            "amount_cents": mov.amount_cents,
            "notes": mov.notes,
            "occurred_at": mov.occurred_at,
            "payment_id": mov.payment_id,
            "invoice_id": pay.invoice_id if pay is not None else None,
            "invoice_number": number,
            "reference": pay.reference if pay is not None else "",
            "user_id": mov.user_id,
        })
    return out


def user_names(db: Session, ids: set[int | None]) -> dict[int, str]:
    clean = {i for i in ids if i is not None}
    if not clean:
        return {}
    return dict(db.execute(select(User.id, User.name).where(User.id.in_(clean))).all())  # type: ignore[arg-type]

