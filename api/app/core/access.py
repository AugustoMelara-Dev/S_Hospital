"""Row-level access rules for invoices (SPEC §3).

- "Operar" (cobrar, anular, revertir, reimprimir) = ``invoices.operate_any`` OR
  (``issued_by == user`` AND issued today in Honduras time).
- Viewing other users' invoices or previous days requires ``invoices.operate_any``
  or ``reports.all``.
"""

from __future__ import annotations

from typing import Protocol

from app.core.errors import ForbiddenError
from app.core.timeutil import hn_date_of, hn_today
from app.models.users import User


class _InvoiceLike(Protocol):
    issued_by: int
    issued_at: object


def can_view_any_invoices(user: User) -> bool:
    return user.has_any("invoices.operate_any", "reports.all")


def can_operate_invoice(user: User, invoice: _InvoiceLike) -> bool:
    if user.has_permission("invoices.operate_any"):
        return True
    return invoice.issued_by == user.id and hn_date_of(invoice.issued_at) == hn_today()  # type: ignore[arg-type]


def can_view_invoice(user: User, invoice: _InvoiceLike) -> bool:
    return can_view_any_invoices(user) or can_operate_invoice(user, invoice)


def ensure_can_operate_invoice(user: User, invoice: _InvoiceLike) -> None:
    if not can_operate_invoice(user, invoice):
        raise ForbiddenError(
            "cannot_operate_invoice",
            "Solo puede operar facturas emitidas por usted hoy.",
        )
