"""Reports (SPEC §6 "Reportes") and cash-session figures.

Definitions (all money in integer cents, days in Honduras time):
- Invoice set: invoices issued in ``[date_from, date_to]`` matching the filters
  (``user_id`` = issuer, ``cash_session_id``, ``status`` — ``issued|partial|paid|void`` or
  ``without_charge`` (free_by_rule/zero_price) —, ``category_id`` = has a line of that
  category, ``method`` = has a posted payment with that method).
- ``billed`` = Σ total of non-void invoices; ``pending`` = Σ balance of non-void invoices.
- ``collected`` = Σ posted payments whose ``paid_at`` falls in the period (filters
  ``user_id`` = cashier who took the payment, ``cash_session_id``, ``method``; the
  ``status``/``category_id`` filters apply through the payment's invoice).
- ``voided_cents`` = Σ total of void invoices that were NOT reversed;
  ``reversed_cents`` = Σ total of reversed invoices (no overlap).
- With ``category_id`` the ``lines``/``gratuities``/``top_services`` sections only include
  lines of that category.
- ``reports.own`` (without ``reports.all``) always forces ``user_id`` to the caller.
"""

from __future__ import annotations

import io
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from fastapi import Request
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.errors import ForbiddenError, NotFoundError, ValidationFailedError
from app.core.timeutil import hn_date_of, hn_range_bounds, hn_today, iso_hn
from app.models import (
    CashMovement,
    CashSession,
    Category,
    InstitutionalReceipt,
    Invoice,
    InvoiceItem,
    Payment,
    Service,
    User,
)
from app.models.billing import (
    INVOICE_PAID,
    INVOICE_PARTIAL,
    INVOICE_VOID,
    PAYMENT_METHODS,
    PAYMENT_POSTED,
    SETTLEMENT_FREE_BY_RULE,
    SETTLEMENT_ZERO_PRICE,
)
from app.models.receipts import RECEIPT_ISSUED

MAX_DAYS = 92
STATUS_FILTERS = ("issued", "partial", "paid", "void", "without_charge")
METHOD_LABELS = {"cash": "Efectivo", "transfer": "Transferencia", "card": "Tarjeta",
                 "other": "Otro"}
STATUS_LABELS = {"issued": "Pendiente de cobro", "partial": "Pago parcial", "paid": "Pagada",
                 "void": "Anulada"}
FREE_SETTLEMENTS = (SETTLEMENT_FREE_BY_RULE, SETTLEMENT_ZERO_PRICE)


@dataclass(frozen=True)
class ReportFilters:
    date_from: date
    date_to: date
    method: str | None = None
    status: str | None = None
    user_id: int | None = None
    cash_session_id: int | None = None
    category_id: int | None = None

    def as_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["date_from"] = self.date_from.isoformat()
        d["date_to"] = self.date_to.isoformat()
        return d


def resolve_filters(
    user: User,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    method: str | None = None,
    status: str | None = None,
    user_id: int | None = None,
    cash_session_id: int | None = None,
    category_id: int | None = None,
) -> ReportFilters:
    date_to = date_to or (date_from if date_from and date_from > hn_today() else hn_today())
    date_from = date_from or date_to
    if date_to < date_from:
        raise ValidationFailedError(
            fields={"date_to": "La fecha final debe ser igual o posterior a la inicial."})
    if (date_to - date_from).days + 1 > MAX_DAYS:
        raise ValidationFailedError(
            fields={"date_to": f"El período no puede superar {MAX_DAYS} días."})
    if method is not None and method not in PAYMENT_METHODS:
        raise ValidationFailedError(fields={"method": "Método de pago no válido."})
    if status is not None and status not in STATUS_FILTERS:
        raise ValidationFailedError(fields={"status": "Estado no válido."})
    if not user.has_permission("reports.all"):
        user_id = user.id
    return ReportFilters(date_from, date_to, method, status, user_id, cash_session_id,
                         category_id)


# --- helpers ---------------------------------------------------------------------

def _category_invoice_ids(category_id: int) -> Select[Any]:
    return (
        select(InvoiceItem.invoice_id)
        .join(Service, Service.id == InvoiceItem.service_id)
        .where(Service.category_id == category_id)
    )


def _apply_invoice_status_category(stmt: Select[Any], f: ReportFilters) -> Select[Any]:
    if f.status == "without_charge":
        stmt = stmt.where(Invoice.settlement.in_(FREE_SETTLEMENTS), Invoice.status != INVOICE_VOID)
    elif f.status:
        stmt = stmt.where(Invoice.status == f.status)
    if f.category_id:
        stmt = stmt.where(Invoice.id.in_(_category_invoice_ids(f.category_id)))
    return stmt


def _invoices(db: Session, f: ReportFilters) -> list[Invoice]:
    start, end = hn_range_bounds(f.date_from, f.date_to)
    stmt = select(Invoice).where(Invoice.issued_at >= start, Invoice.issued_at < end)
    if f.user_id:
        stmt = stmt.where(Invoice.issued_by == f.user_id)
    if f.cash_session_id:
        stmt = stmt.where(Invoice.cash_session_id == f.cash_session_id)
    if f.method:
        stmt = stmt.where(Invoice.id.in_(
            select(Payment.invoice_id).where(Payment.method == f.method,
                                             Payment.status == PAYMENT_POSTED)))
    stmt = _apply_invoice_status_category(stmt, f)
    return list(db.scalars(stmt.order_by(Invoice.issued_at, Invoice.id)).unique())


def _payments(db: Session, f: ReportFilters) -> list[tuple[Payment, Invoice]]:
    start, end = hn_range_bounds(f.date_from, f.date_to)
    stmt = (
        select(Payment, Invoice)
        .join(Invoice, Invoice.id == Payment.invoice_id)
        .where(Payment.paid_at >= start, Payment.paid_at < end)
    )
    if f.user_id:
        stmt = stmt.where(Payment.user_id == f.user_id)
    if f.cash_session_id:
        stmt = stmt.where(Payment.cash_session_id == f.cash_session_id)
    if f.method:
        stmt = stmt.where(Payment.method == f.method)
    stmt = _apply_invoice_status_category(stmt, f)
    return [(p, i) for p, i in db.execute(stmt.order_by(Payment.paid_at, Payment.id)).unique()]


def _user_names(db: Session, ids: set[int]) -> dict[int, str]:
    if not ids:
        return {}
    return dict(db.execute(select(User.id, User.name).where(User.id.in_(ids))).all())


def _receipt_numbers(db: Session, invoice_ids: list[int]) -> dict[int, str]:
    out: dict[int, str] = {}
    for i in range(0, len(invoice_ids), 500):
        chunk = invoice_ids[i:i + 500]
        out.update(db.execute(
            select(InstitutionalReceipt.invoice_id, InstitutionalReceipt.number_full)
            .where(InstitutionalReceipt.invoice_id.in_(chunk),
                   InstitutionalReceipt.status == RECEIPT_ISSUED)
        ).all())
    return out


def _avg(total: int, count: int) -> int:
    return (2 * total + count) // (2 * count) if count else 0


def method_breakdown(payments: list[Payment]) -> list[dict[str, Any]]:
    agg = {m: [0, 0] for m in PAYMENT_METHODS}
    for p in payments:
        if p.status == PAYMENT_POSTED:
            agg.setdefault(p.method, [0, 0])
            agg[p.method][0] += 1
            agg[p.method][1] += p.amount_cents
    return [{"method": m, "label": METHOD_LABELS.get(m, m), "count": c, "amount_cents": a}
            for m, (c, a) in agg.items()]


def session_figures(db: Session, session: CashSession) -> dict[str, Any]:
    """Live figures of a cash session (stored values are used once closed)."""
    posted = list(db.scalars(select(Payment).where(
        Payment.cash_session_id == session.id, Payment.status == PAYMENT_POSTED)))
    method_totals = dict.fromkeys(PAYMENT_METHODS, 0)
    for p in posted:
        method_totals[p.method] = method_totals.get(p.method, 0) + p.amount_cents
    cash_moves = db.scalar(select(func.coalesce(func.sum(CashMovement.amount_cents), 0)).where(
        CashMovement.cash_session_id == session.id,
        CashMovement.method == "cash",
        CashMovement.type.in_(("payment", "payment_void")),
    )) or 0
    expected = session.opening_cents + int(cash_moves)
    closed = not session.is_open
    return {
        "method_totals": (session.method_totals if closed and session.method_totals
                          else method_totals),
        "payments_count": session.payments_count if closed else len(posted),
        "payments_total_cents": (session.payments_total_cents if closed
                                 else sum(p.amount_cents for p in posted)),
        "expected_cash_cents": (session.expected_cash_cents
                                if closed and session.expected_cash_cents is not None
                                else expected),
    }


def _session_row(db: Session, s: CashSession) -> dict[str, Any]:
    fig = session_figures(db, s)
    return {
        "id": s.id,
        "register_name": s.cash_register.name if s.cash_register else "",
        "user_id": s.user_id,
        "user_name": s.user.name if s.user else "",
        "status": s.status,
        "opened_at": iso_hn(s.opened_at),
        "closed_at": iso_hn(s.closed_at),
        "opening_cents": s.opening_cents,
        "expected_cash_cents": fig["expected_cash_cents"],
        "counted_cents": s.counted_cents,
        "difference_cents": s.difference_cents,
        "payments_count": fig["payments_count"],
        "payments_total_cents": fig["payments_total_cents"],
        "method_totals": fig["method_totals"],
    }


def _operation_row(inv: Invoice, names: dict[int, str], receipts: dict[int, str]
                   ) -> dict[str, Any]:
    return {
        "id": inv.id,
        "number": inv.number,
        "issued_at": iso_hn(inv.issued_at),
        "patient_name": inv.patient_name,
        "status": inv.status,
        "status_label": STATUS_LABELS.get(inv.status, inv.status),
        "settlement": inv.settlement,
        "reversed": inv.reversed,
        "total_cents": inv.total_cents,
        "paid_cents": inv.paid_cents,
        "balance_cents": inv.balance_cents,
        "cashier_name": names.get(inv.issued_by, ""),
        "cash_session_id": inv.cash_session_id,
        "receipt_number": receipts.get(inv.id),
    }


# --- summary -----------------------------------------------------------------------

def summary(db: Session, f: ReportFilters) -> dict[str, Any]:
    invoices = _invoices(db, f)
    pay_rows = _payments(db, f)
    names = _user_names(db, {i.issued_by for i in invoices} | {p.user_id for p, _ in pay_rows})
    receipts = _receipt_numbers(db, [i.id for i in invoices])
    non_void = [i for i in invoices if i.status != INVOICE_VOID]
    posted = [p for p, _ in pay_rows if p.status == PAYMENT_POSTED]

    category_services: set[int] | None = None
    if f.category_id:
        category_services = set(db.scalars(
            select(Service.id).where(Service.category_id == f.category_id)))

    lines: list[dict[str, Any]] = []
    gratuities: list[dict[str, Any]] = []
    top: dict[str, dict[str, Any]] = {}
    free_count = free_value = 0
    for inv in non_void:
        for it in inv.items:
            if category_services is not None and it.service_id not in category_services:
                continue
            lines.append({
                "invoice_id": inv.id, "invoice_number": inv.number,
                "issued_at": iso_hn(inv.issued_at), "patient_name": inv.patient_name,
                "service_name": it.service_name, "category_name": it.category_name,
                "area_name": it.area_name, "quantity_hundredths": it.quantity_hundredths,
                "unit_price_registered_cents": it.unit_price_registered_cents,
                "unit_price_cents": it.unit_price_cents,
                "rule_adjustment_cents": it.rule_adjustment_cents, "rate_bp": it.rate_bp,
                "line_subtotal_cents": it.line_subtotal_cents, "tax_cents": it.tax_cents,
                "line_total_cents": it.line_total_cents,
                "special_rule_applied": it.special_rule_applied,
            })
            t = top.setdefault(it.service_name, {
                "service_name": it.service_name, "category_name": it.category_name,
                "quantity_hundredths": 0, "lines_count": 0, "amount_cents": 0})
            t["quantity_hundredths"] += it.quantity_hundredths
            t["lines_count"] += 1
            t["amount_cents"] += it.line_total_cents
            if it.special_rule_applied:
                free_count += 1
                free_value += it.rule_adjustment_cents
                gratuities.append({
                    "invoice_id": inv.id, "invoice_number": inv.number,
                    "issued_at": iso_hn(inv.issued_at), "patient_name": inv.patient_name,
                    "service_name": it.service_name,
                    "quantity_hundredths": it.quantity_hundredths,
                    "unit_price_registered_cents": it.unit_price_registered_cents,
                    "value_cents": it.rule_adjustment_cents,
                    "cashier_name": names.get(inv.issued_by, ""),
                })

    billed = sum(i.total_cents for i in non_void)
    collected = sum(p.amount_cents for p in posted)
    summary_block = {
        "billed_cents": billed,
        "collected_cents": collected,
        "pending_cents": sum(i.balance_cents for i in non_void),
        "without_charge_count": sum(1 for i in non_void if i.settlement in FREE_SETTLEMENTS),
        "invoices_count": len(non_void),
        "paid_count": sum(1 for i in non_void if i.status == INVOICE_PAID),
        "partial_count": sum(1 for i in non_void if i.status == INVOICE_PARTIAL),
        "average_ticket_cents": _avg(billed, len(non_void)),
        "voided_count": sum(1 for i in invoices if i.status == INVOICE_VOID),
        "voided_cents": sum(i.total_cents for i in invoices
                            if i.status == INVOICE_VOID and not i.reversed),
        "reversed_cents": sum(i.total_cents for i in invoices if i.reversed),
        "free_lines_count": free_count,
        "free_value_cents": free_value,
        "payments_count": len(posted),
    }

    daily_map: dict[date, dict[str, int]] = defaultdict(
        lambda: {"billed_cents": 0, "collected_cents": 0, "invoices_count": 0})
    for inv in non_void:
        d = daily_map[hn_date_of(inv.issued_at)]
        d["billed_cents"] += inv.total_cents
        d["invoices_count"] += 1
    for p in posted:
        daily_map[hn_date_of(p.paid_at)]["collected_cents"] += p.amount_cents
    daily = []
    day = f.date_from
    while day <= f.date_to:
        daily.append({"date": day.isoformat(), **daily_map[day]})
        day += timedelta(days=1)

    sess_stmt = select(CashSession)
    start, end = hn_range_bounds(f.date_from, f.date_to)
    sess_stmt = sess_stmt.where(CashSession.opened_at >= start, CashSession.opened_at < end)
    if f.user_id:
        sess_stmt = sess_stmt.where(CashSession.user_id == f.user_id)
    if f.cash_session_id:
        sess_stmt = sess_stmt.where(CashSession.id == f.cash_session_id)
    sessions = [_session_row(db, s) for s in
                db.scalars(sess_stmt.order_by(CashSession.opened_at)).unique()]

    payments = [{
        "id": p.id, "invoice_id": inv.id, "invoice_number": inv.number,
        "patient_name": inv.patient_name, "paid_at": iso_hn(p.paid_at), "method": p.method,
        "method_label": METHOD_LABELS.get(p.method, p.method), "reference": p.reference,
        "amount_cents": p.amount_cents, "received_cents": p.received_cents,
        "change_cents": p.change_cents, "status": p.status,
        "cashier_name": names.get(p.user_id, ""), "cash_session_id": p.cash_session_id,
    } for p, inv in pay_rows]

    return {
        "filters": f.as_dict(),
        "summary": summary_block,
        "by_method": method_breakdown(posted),
        "daily": daily,
        "operations": [_operation_row(i, names, receipts) for i in invoices],
        "lines": lines,
        "payments": payments,
        "sessions": sessions,
        "gratuities": gratuities,
        "top_services": sorted(top.values(), key=lambda r: (-r["amount_cents"],
                                                            r["service_name"]))[:10],
    }


def today(db: Session, user: User) -> dict[str, Any]:
    f = resolve_filters(user)
    invoices = _invoices(db, f)
    pay_rows = _payments(db, f)
    names = _user_names(db, {i.issued_by for i in invoices})
    receipts = _receipt_numbers(db, [i.id for i in invoices])
    non_void = [i for i in invoices if i.status != INVOICE_VOID]
    posted = [p for p, _ in pay_rows if p.status == PAYMENT_POSTED]
    pending = [i for i in non_void if i.balance_cents > 0]
    missing = [i for i in non_void if i.status == INVOICE_PAID and i.id not in receipts]

    current = db.scalar(select(CashSession).where(
        CashSession.user_id == user.id, CashSession.status == "open"))
    current_row = None
    if current is not None:
        current_row = _session_row(db, current)
    recent = sorted(invoices, key=lambda i: (i.issued_at, i.id), reverse=True)[:10]
    return {
        "date": f.date_from.isoformat(),
        "scope": "all" if user.has_permission("reports.all") else "own",
        "billed_cents": sum(i.total_cents for i in non_void),
        "collected_cents": sum(p.amount_cents for p in posted),
        "pending_cents": sum(i.balance_cents for i in non_void),
        "without_charge_count": sum(1 for i in non_void if i.settlement in FREE_SETTLEMENTS),
        "voided_count": sum(1 for i in invoices if i.status == INVOICE_VOID),
        "invoices_count": len(non_void),
        "payments_count": len(posted),
        "by_method": method_breakdown(posted),
        "current_session": current_row,
        "recent_operations": [_operation_row(i, names, receipts) for i in recent],
        "attention": {
            "pending_count": len(pending),
            "pending_cents": sum(i.balance_cents for i in pending),
            "missing_receipts_count": len(missing),
        },
    }


# --- exports ---------------------------------------------------------------------------

def _filters_text(db: Session, f: ReportFilters) -> str:
    parts = [f"Período: {f.date_from:%d/%m/%Y} al {f.date_to:%d/%m/%Y}"]
    if f.user_id:
        name = db.scalar(select(User.name).where(User.id == f.user_id))
        parts.append(f"Cajero: {name or f.user_id}")
    if f.method:
        parts.append(f"Método: {METHOD_LABELS.get(f.method, f.method)}")
    if f.status:
        parts.append("Estado: " + (STATUS_LABELS.get(f.status) or "Emitida sin cobro"))
    if f.cash_session_id:
        parts.append(f"Turno de caja: {f.cash_session_id}")
    if f.category_id:
        name = db.scalar(select(Category.name).where(Category.id == f.category_id))
        parts.append(f"Categoría: {name or f.category_id}")
    return " · ".join(parts)


def summary_pdf(db: Session, user: User, f: ReportFilters, request: Request
                ) -> tuple[bytes, str]:
    from app.services import pdf_reports

    data = summary(db, f)
    pdf = pdf_reports.render_summary_pdf(data, _filters_text(db, f), user.name)
    audit(db, user, "report.exported", new={"format": "pdf", **f.as_dict()}, request=request,
          commit=True)
    return pdf, f"reporte-{f.date_from}-{f.date_to}.pdf"


MONEY_FORMAT = '"L" #,##0.00'


def _money(cents: int | None) -> Decimal | None:
    return None if cents is None else Decimal(int(cents)) / 100


def _qty(hundredths: int) -> Decimal:
    return Decimal(int(hundredths)) / 100


def summary_xlsx(db: Session, user: User, f: ReportFilters, request: Request
                 ) -> tuple[bytes, str]:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    from openpyxl.utils import get_column_letter

    data = summary(db, f)
    wb = Workbook()
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="0F5C4D")

    def sheet(title: str, headers: list[tuple[str, str]], rows: list[dict[str, Any]],
              first: bool = False) -> None:
        ws = wb.active if first else wb.create_sheet()
        assert ws is not None
        ws.title = title
        ws.append([h for h, _ in headers])
        for cell in ws[1]:
            cell.font = header_font
            cell.fill = header_fill
        for row in rows:
            values: list[Any] = []
            for _, key in headers:
                v = row.get(key)
                if key.endswith("_cents"):
                    v = _money(v)
                elif key == "quantity_hundredths":
                    v = _qty(v or 0)
                elif isinstance(v, bool):
                    v = "Sí" if v else "No"
                values.append(v)
            ws.append(values)
        for idx, (_, key) in enumerate(headers, start=1):
            letter = get_column_letter(idx)
            ws.column_dimensions[letter].width = max(12, min(40, len(headers[idx - 1][0]) + 6))
            if key.endswith("_cents"):
                for (cell,) in ws.iter_rows(min_row=2, min_col=idx, max_col=idx):
                    cell.number_format = MONEY_FORMAT
        ws.freeze_panes = "A2"

    s = data["summary"]
    summary_rows = [
        {"label": "Período", "value": f"{f.date_from:%d/%m/%Y} al {f.date_to:%d/%m/%Y}"},
        {"label": "Filtros", "value": _filters_text(db, f)},
    ]
    kpis = [
        ("Facturado", "billed_cents"), ("Cobrado", "collected_cents"),
        ("Saldo pendiente", "pending_cents"), ("Ticket promedio", "average_ticket_cents"),
        ("Anulado", "voided_cents"), ("Reversado", "reversed_cents"),
        ("Valor líneas gratuitas", "free_value_cents"),
    ]
    counts = [
        ("Operaciones", "invoices_count"), ("Pagadas", "paid_count"),
        ("Pago parcial", "partial_count"), ("Sin cobro", "without_charge_count"),
        ("Anuladas", "voided_count"), ("Líneas gratuitas", "free_lines_count"),
    ]
    ws = wb.active
    assert ws is not None
    ws.title = "Resumen"
    ws.append(["Indicador", "Valor"])
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
    for r in summary_rows:
        ws.append([r["label"], r["value"]])
    for label, key in kpis:
        ws.append([label, _money(s[key])])
        ws.cell(row=ws.max_row, column=2).number_format = MONEY_FORMAT
    for label, key in counts:
        ws.append([label, s[key]])
    ws.column_dimensions["A"].width = 26
    ws.column_dimensions["B"].width = 60

    sheet("Por método", [("Método", "label"), ("Cobros", "count"), ("Monto", "amount_cents")],
          data["by_method"])
    sheet("Diario", [("Fecha", "date"), ("Facturado", "billed_cents"),
                     ("Cobrado", "collected_cents"), ("Operaciones", "invoices_count")],
          data["daily"])
    sheet("Operaciones", [
        ("Documento", "number"), ("Fecha", "issued_at"), ("Paciente", "patient_name"),
        ("Estado", "status_label"), ("Total", "total_cents"), ("Pagado", "paid_cents"),
        ("Saldo", "balance_cents"), ("Cajero", "cashier_name"), ("Recibo", "receipt_number"),
        ("Reversada", "reversed")], data["operations"])
    sheet("Detalle", [
        ("Documento", "invoice_number"), ("Fecha", "issued_at"), ("Paciente", "patient_name"),
        ("Concepto", "service_name"), ("Categoría", "category_name"),
        ("Cantidad", "quantity_hundredths"), ("Precio", "unit_price_registered_cents"),
        ("Ajuste", "rule_adjustment_cents"), ("Importe", "line_subtotal_cents"),
        ("ISV", "tax_cents"), ("Total", "line_total_cents")], data["lines"])
    sheet("Cobros", [
        ("Fecha", "paid_at"), ("Documento", "invoice_number"), ("Paciente", "patient_name"),
        ("Método", "method_label"), ("Referencia", "reference"), ("Monto", "amount_cents"),
        ("Estado", "status"), ("Cajero", "cashier_name")], data["payments"])
    sheet("Caja", [
        ("Caja", "register_name"), ("Operador", "user_name"), ("Estado", "status"),
        ("Apertura", "opened_at"), ("Cierre", "closed_at"), ("Monto inicial", "opening_cents"),
        ("Efectivo esperado", "expected_cash_cents"), ("Contado", "counted_cents"),
        ("Diferencia", "difference_cents"), ("Cobros", "payments_count"),
        ("Total cobrado", "payments_total_cents")], data["sessions"])
    sheet("Gratuidades", [
        ("Documento", "invoice_number"), ("Fecha", "issued_at"), ("Paciente", "patient_name"),
        ("Concepto", "service_name"), ("Cantidad", "quantity_hundredths"),
        ("Valor", "value_cents"), ("Cajero", "cashier_name")], data["gratuities"])
    sheet("Top servicios", [
        ("Concepto", "service_name"), ("Categoría", "category_name"),
        ("Cantidad", "quantity_hundredths"), ("Líneas", "lines_count"),
        ("Importe", "amount_cents")], data["top_services"])

    buf = io.BytesIO()
    wb.save(buf)
    audit(db, user, "report.exported", new={"format": "xlsx", **f.as_dict()}, request=request,
          commit=True)
    return buf.getvalue(), f"reporte-{f.date_from}-{f.date_to}.xlsx"


# --- cash session summary -----------------------------------------------------------------

def cash_session_summary(db: Session, user: User, session_id: int) -> dict[str, Any]:
    session = db.get(CashSession, session_id)
    if session is None:
        raise NotFoundError("cash_session_not_found", "La sesión de caja no existe.")
    if session.user_id != user.id and not user.has_any(
        "cash.close_any", "reports.all", "invoices.operate_any"
    ):
        raise ForbiddenError("cannot_view_cash_session",
                             "Solo puede consultar sus propias sesiones de caja.")
    row = _session_row(db, session)
    movements = list(db.scalars(select(CashMovement).where(
        CashMovement.cash_session_id == session.id).order_by(CashMovement.occurred_at,
                                                              CashMovement.id)))
    payment_ids = [m.payment_id for m in movements if m.payment_id]
    pay_docs: dict[int, str] = {}
    if payment_ids:
        pay_docs = dict(db.execute(
            select(Payment.id, Invoice.number).join(Invoice, Invoice.id == Payment.invoice_id)
            .where(Payment.id.in_(payment_ids))).all())
    invoices = list(db.scalars(select(Invoice).where(Invoice.cash_session_id == session.id)))
    closer = db.get(User, session.closed_by) if session.closed_by else None
    return {
        **row,
        "closed_by_name": closer.name if closer else None,
        "opening_notes": session.opening_notes,
        "closing_notes": session.closing_notes,
        "closing_breakdown": session.closing_breakdown,
        "invoices_count": sum(1 for i in invoices if i.status != INVOICE_VOID),
        "billed_cents": sum(i.total_cents for i in invoices if i.status != INVOICE_VOID),
        "voided_count": sum(1 for i in invoices if i.status == INVOICE_VOID),
        "pending_count": sum(1 for i in invoices
                             if i.status in ("issued", "partial")),
        "movements": [{
            "occurred_at": iso_hn(m.occurred_at), "type": m.type, "method": m.method,
            "reference": pay_docs.get(m.payment_id or 0, m.notes or ""),
            "amount_cents": m.amount_cents,
        } for m in movements],
    }


def cash_session_summary_pdf(db: Session, user: User, session_id: int) -> tuple[bytes, str]:
    from app.services import pdf_reports

    data = cash_session_summary(db, user, session_id)
    return pdf_reports.render_cash_session_pdf(data), f"resumen-caja-{session_id}.pdf"
