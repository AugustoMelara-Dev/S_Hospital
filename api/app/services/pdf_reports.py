"""Report PDFs (ReportLab): period summary (landscape letter) and cash-session summary.

    render_summary_pdf(report: dict, filters_text: str, generated_by: str) -> bytes
    render_cash_session_pdf(data: dict) -> bytes

``report`` is the dict returned by ``app.services.reports.summary``; ``data`` the one
returned by ``app.services.reports.cash_session_summary``.
"""

from __future__ import annotations

from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import BaseDocTemplate, Paragraph, Spacer, Table, TableStyle

from app.core.money import format_money
from app.core.timeutil import iso_hn, now_utc
from app.services.pdf_receipt import (
    BAND,
    BRAND,
    INK,
    INK_2,
    LINE,
    SOFT,
    build_pdf,
    esc,
    fmt_datetime,
    fmt_qty,
    fonts,
)

MAX_ROWS = 2000
MOVEMENT_LABELS = {"opening": "Apertura", "payment": "Cobro", "payment_void": "Cobro anulado",
                   "closing": "Cierre"}
METHOD_LABELS = {"cash": "Efectivo", "transfer": "Transferencia", "card": "Tarjeta",
                 "other": "Otro"}


class _St:
    def __init__(self, base: float = 8) -> None:
        regular, bold = fonts()
        self.regular, self.bold = regular, bold
        self.body = ParagraphStyle("b", fontName=regular, fontSize=base, leading=base * 1.2,
                                   textColor=INK)
        self.small = ParagraphStyle("s", parent=self.body, fontSize=base - 1,
                                    leading=(base - 1) * 1.2, textColor=INK_2)
        self.right = ParagraphStyle("r", parent=self.body, alignment=TA_RIGHT)
        self.title = ParagraphStyle("t", parent=self.body, fontName=bold, fontSize=base + 7,
                                    leading=(base + 7) * 1.2)
        self.h2 = ParagraphStyle("h2", parent=self.body, fontName=bold, fontSize=base + 2,
                                 leading=(base + 2) * 1.3, textColor=BRAND, spaceBefore=6,
                                 spaceAfter=2)
        self.kpi_label = ParagraphStyle("kl", parent=self.small, fontName=bold)
        self.kpi_value = ParagraphStyle("kv", parent=self.body, fontName=bold,
                                        fontSize=base + 4, leading=(base + 4) * 1.2)
        self.head = ParagraphStyle("h", parent=self.small, fontName=bold, textColor=INK)
        self.head_r = ParagraphStyle("hr", parent=self.head, alignment=TA_RIGHT)


def _table(st: _St, width: float, columns: list[tuple[str, str, float]],
           rows: list[dict[str, Any]], empty: str = "Sin registros.") -> list[Any]:
    """``columns`` = [(header, key, relative width)]; ``*_cents`` keys are money,
    ``quantity_hundredths`` is a quantity, ``*_at`` dates."""
    total_w = sum(c[2] for c in columns)
    widths = [width * c[2] / total_w for c in columns]
    numeric = [k.endswith(("_cents", "count", "hundredths")) for _, k, _ in columns]
    data: list[list[Any]] = [[Paragraph(esc(h), st.head_r if numeric[i] else st.head)
                              for i, (h, _, _) in enumerate(columns)]]
    for row in rows[:MAX_ROWS]:
        cells: list[Any] = []
        for i, (_, key, _) in enumerate(columns):
            v = row.get(key)
            if key.endswith("_cents"):
                text = "—" if v is None else format_money(int(v))
            elif key == "quantity_hundredths":
                text = fmt_qty(v)
            elif key.endswith("_at"):
                text = fmt_datetime(v) if v else "—"
            elif isinstance(v, bool):
                text = "Sí" if v else "No"
            else:
                text = "" if v is None else str(v)
            cells.append(Paragraph(esc(text), st.right if numeric[i] else st.body))
        data.append(cells)
    out: list[Any] = []
    if len(data) == 1:
        out.append(Paragraph(empty, st.small))
        return out
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, 0), SOFT),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, INK_2),
        ("LINEBELOW", (0, 1), (-1, -1), 0.25, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]))
    out.append(t)
    if len(rows) > MAX_ROWS:
        out.append(Paragraph(
            f"Se muestran {MAX_ROWS} de {len(rows)} filas. Exporte a Excel para el detalle "
            "completo.", st.small))
    return out


def _kpi_band(st: _St, width: float, kpis: list[tuple[str, str]], per_row: int) -> Table:
    rows: list[list[Any]] = []
    for i in range(0, len(kpis), per_row):
        chunk = kpis[i:i + per_row]
        row = [[Paragraph(esc(label), st.kpi_label), Paragraph(esc(value), st.kpi_value)]
               for label, value in chunk]
        while len(row) < per_row:
            row.append("")
        rows.append(row)
    t = Table(rows, colWidths=[width / per_row] * per_row)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BAND),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def _footer(st: _St, text: str) -> Any:
    def draw(canvas: Canvas, doc: BaseDocTemplate) -> None:
        canvas.saveState()
        canvas.setFont(st.regular, 7)
        canvas.setFillColor(INK_2)
        w, _h = doc.pagesize
        canvas.drawString(doc.leftMargin, doc.bottomMargin * 0.45, text)
        canvas.drawRightString(w - doc.rightMargin, doc.bottomMargin * 0.45,
                               f"Página {doc.page}")
        canvas.restoreState()

    return draw


def render_summary_pdf(report: dict[str, Any], filters_text: str, generated_by: str) -> bytes:
    st = _St(8)
    page = landscape(letter)
    margin = 12 * mm
    width = page[0] - 2 * margin
    s = report.get("summary", {})
    m = format_money
    story: list[Any] = [
        Paragraph("Reporte de caja y facturación", st.title),
        Paragraph(esc(filters_text), st.small),
        Spacer(0, 4 * mm),
        _kpi_band(st, width, [
            ("Facturado", m(s.get("billed_cents", 0))),
            ("Cobrado", m(s.get("collected_cents", 0))),
            ("Saldo pendiente", m(s.get("pending_cents", 0))),
            ("Sin cobro", str(s.get("without_charge_count", 0))),
            ("Ticket promedio", m(s.get("average_ticket_cents", 0))),
            ("Anulado", m(s.get("voided_cents", 0))),
            ("Reversado", m(s.get("reversed_cents", 0))),
            ("Líneas gratuitas", f"{s.get('free_lines_count', 0)} · "
                                 f"{m(s.get('free_value_cents', 0))}"),
        ], 4),
        Paragraph(esc(f"Operaciones: {s.get('invoices_count', 0)} · Pagadas: "
                      f"{s.get('paid_count', 0)} · Pago parcial: {s.get('partial_count', 0)}"
                      f" · Anuladas: {s.get('voided_count', 0)}"), st.small),
    ]
    half = (width - 6 * mm) / 2
    by_method = _table(st, half, [("Método", "label", 3), ("Cobros", "count", 2),
                                  ("Monto", "amount_cents", 3)], report.get("by_method", []))
    top = _table(st, half, [("Concepto", "service_name", 5), ("Cantidad", "quantity_hundredths", 2),
                            ("Importe", "amount_cents", 3)], report.get("top_services", []))
    pair = Table([[[Paragraph("Cobros por método", st.h2), *by_method],
                   [Paragraph("Servicios principales", st.h2), *top]]],
                 colWidths=[half + 6 * mm, half])
    pair.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                              ("LEFTPADDING", (0, 0), (-1, -1), 0),
                              ("RIGHTPADDING", (0, 0), (0, 0), 6 * mm)]))
    story.append(pair)

    daily = [d for d in report.get("daily", []) if d.get("invoices_count")
             or d.get("collected_cents")]
    story += [Paragraph("Resumen diario", st.h2),
              *_table(st, width * 0.6, [("Fecha", "date", 2), ("Operaciones", "invoices_count", 2),
                                        ("Facturado", "billed_cents", 3),
                                        ("Cobrado", "collected_cents", 3)], daily)]
    story += [Paragraph("Operaciones", st.h2), *_table(st, width, [
        ("Documento", "number", 3), ("Fecha", "issued_at", 2.3), ("Paciente", "patient_name", 4),
        ("Estado", "status_label", 2), ("Total", "total_cents", 2), ("Pagado", "paid_cents", 2),
        ("Saldo", "balance_cents", 2), ("Cajero", "cashier_name", 3),
        ("Recibo", "receipt_number", 2.5)], report.get("operations", []))]
    story += [Paragraph("Cobros", st.h2), *_table(st, width, [
        ("Fecha", "paid_at", 2.3), ("Documento", "invoice_number", 3),
        ("Paciente", "patient_name", 4), ("Método", "method_label", 2),
        ("Referencia", "reference", 2.5), ("Monto", "amount_cents", 2), ("Estado", "status", 1.5),
        ("Cajero", "cashier_name", 3)], report.get("payments", []))]
    story += [Paragraph("Caja", st.h2), *_table(st, width, [
        ("Caja", "register_name", 2.5), ("Operador", "user_name", 3),
        ("Apertura", "opened_at", 2.3),
        ("Cierre", "closed_at", 2.3), ("Inicial", "opening_cents", 2),
        ("Esperado", "expected_cash_cents", 2), ("Contado", "counted_cents", 2),
        ("Diferencia", "difference_cents", 2), ("Cobros", "payments_count", 1.3)],
        report.get("sessions", []))]
    story += [Paragraph("Gratuidades", st.h2), *_table(st, width, [
        ("Documento", "invoice_number", 3), ("Fecha", "issued_at", 2.3),
        ("Paciente", "patient_name", 4), ("Concepto", "service_name", 4),
        ("Cantidad", "quantity_hundredths", 1.5), ("Valor", "value_cents", 2)],
        report.get("gratuities", []), empty="Sin líneas gratuitas en el período.")]

    footer_text = f"Generado por {generated_by} · {fmt_datetime(iso_hn(now_utc()))}"
    return build_pdf(story, page, margin, title="Reporte de caja y facturación",
                     footer=_footer(st, footer_text))


def render_cash_session_pdf(data: dict[str, Any]) -> bytes:
    st = _St(8.5)
    page = letter
    margin = 14 * mm
    width = page[0] - 2 * margin
    m = format_money
    status = "Abierta" if data.get("status") == "open" else "Cerrada"
    diff = data.get("difference_cents")
    diff_text = "—"
    if diff is not None:
        diff_text = "Cuadra" if diff == 0 else (
            f"Sobrante {m(diff)}" if diff > 0 else f"Faltante {m(-diff)}")
    story: list[Any] = [
        Paragraph("Resumen de cierre de caja", st.title),
        Paragraph(esc(f"{data.get('register_name', '')} · Operador: {data.get('user_name', '')}"
                      f" · Estado: {status}"), st.small),
        Paragraph(esc(f"Apertura: {fmt_datetime(data.get('opened_at'))}"
                      + (f" · Cierre: {fmt_datetime(data.get('closed_at'))}"
                         if data.get("closed_at") else "")
                      + (f" · Cerrada por: {data.get('closed_by_name')}"
                         if data.get("closed_by_name") else "")), st.small),
        Spacer(0, 4 * mm),
        _kpi_band(st, width, [
            ("Monto inicial", m(data.get("opening_cents") or 0)),
            ("Efectivo esperado", m(data.get("expected_cash_cents") or 0)),
            ("Total contado", m(data["counted_cents"]) if data.get("counted_cents") is not None
             else "—"),
            ("Diferencia", diff_text),
            ("Cobros registrados", str(data.get("payments_count") or 0)),
            ("Total cobrado", m(data.get("payments_total_cents") or 0)),
            ("Operaciones", str(data.get("invoices_count") or 0)),
            ("Pendientes", str(data.get("pending_count") or 0)),
        ], 4),
    ]
    totals = data.get("method_totals") or {}
    story += [Paragraph("Cobros por método", st.h2), *_table(st, width * 0.5, [
        ("Método", "label", 3), ("Monto", "amount_cents", 2)],
        [{"label": METHOD_LABELS.get(k, k), "amount_cents": v} for k, v in totals.items()])]
    story.append(Paragraph("Solo el efectivo entra a la gaveta.", st.small))
    breakdown = data.get("closing_breakdown") or {}
    bills = breakdown.get("bills") or {}
    if bills or breakdown.get("coins_cents"):
        rows = [{"label": f"L {k}", "count": n, "amount_cents": int(k) * 100 * int(n)}
                for k, n in sorted(bills.items(), key=lambda kv: -int(kv[0])) if int(n)]
        rows.append({"label": "Monedas y otros", "count": None,
                     "amount_cents": int(breakdown.get("coins_cents") or 0)})
        story += [Paragraph("Arqueo", st.h2), *_table(st, width * 0.5, [
            ("Denominación", "label", 3), ("Cantidad", "count", 2), ("Monto", "amount_cents", 2)],
            rows)]
    movements = [{**mv, "type_label": MOVEMENT_LABELS.get(mv.get("type"), mv.get("type")),
                  "method_label": METHOD_LABELS.get(mv.get("method") or "", "—")}
                 for mv in data.get("movements", [])]
    story += [Paragraph("Movimientos", st.h2), *_table(st, width, [
        ("Hora", "occurred_at", 2.5), ("Tipo", "type_label", 2.5), ("Referencia", "reference", 4),
        ("Método", "method_label", 2), ("Monto", "amount_cents", 2)], movements)]
    if data.get("closing_notes"):
        story += [Paragraph("Nota de cierre", st.h2), Paragraph(esc(data["closing_notes"]),
                                                                st.body)]
    sig = Table([["", "", ""], [Paragraph("Firma del cajero", st.small), "",
                                Paragraph("Firma de supervisión", st.small)]],
                colWidths=[width * 0.4, width * 0.2, width * 0.4], rowHeights=[16 * mm, None])
    sig.setStyle(TableStyle([("LINEBELOW", (0, 0), (0, 0), 0.6, INK),
                             ("LINEBELOW", (2, 0), (2, 0), 0.6, INK),
                             ("ALIGN", (0, 1), (-1, 1), "CENTER")]))
    story += [Spacer(0, 6 * mm), sig]
    return build_pdf(story, page, margin, title="Resumen de caja",
                     footer=_footer(st, f"Generado {fmt_datetime(iso_hn(now_utc()))}"))
