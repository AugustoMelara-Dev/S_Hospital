"""Institutional receipt PDF (ReportLab, offline) — docs/TERMINOLOGIA.md "Recibo institucional".

Public API::

    render_institutional_receipt(snapshot, profile, copy_labels, reprint_no, watermark,
                                 logo=None) -> bytes
    copy_labels_for(profile) -> ["ORIGINAL", "PRIMERA COPIA", ...]
    ensure_institutional_profile(profile)      # thermal / inactive -> 400
    snapshot_from_models(...) / merge_snapshot(base, override)

``snapshot`` is the JSON stored in ``institutional_receipts.snapshot``. Every key is
read defensively with ``.get`` so the renderer tolerates partial snapshots::

    {institution:{hospital_name,rtn,address,phone,government_line,secretariat_line,
                  receipt_location,receipt_footer_text},
     fiscal:{cai,range_from,range_to,valid_until},
     invoice:{number,issued_at,patient_name,cashier_name,register_name,status},
     items:[{name,quantity_hundredths,unit_price_cents,unit_price_registered_cents,
             rule_adjustment_cents,line_subtotal_cents,tax_cents,line_total_cents,
             special_rule_applied,rate_bp}],
     totals:{subtotal_cents,exempt_cents,taxable_cents,tax_cents,total_cents,paid_cents,
             balance_cents,tax_breakdown:[{rate_bp,base_cents,tax_cents,label}]},
     payments:[{method,reference,amount_cents,paid_at}],
     series:{series,prefix,legal_text,number_color},
     receipt:{number_full,amount_words,issued_at}}

``profile`` is a ``PrintProfile`` (or any object exposing ``paper``, ``width_mm``,
``height_mm``, ``margins_mm``, ``show_seal_space``, ``use_logo``). One page per copy
(more only if the item list overflows). The receipt never shows QR codes, barcodes
or internal ids.
"""

from __future__ import annotations

import io
import math
from collections.abc import Callable, Iterable, Mapping
from datetime import date, datetime
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from app.core.errors import BusinessRuleError
from app.core.money import amount_in_words, format_money
from app.core.timeutil import to_hn

THERMAL_PAPERS = ("thermal_80", "thermal_58")
COPY_LABELS: dict[str, list[str]] = {
    "original_only": ["ORIGINAL"],
    "original_first": ["ORIGINAL", "PRIMERA COPIA"],
    "original_first_second": ["ORIGINAL", "PRIMERA COPIA", "SEGUNDA COPIA"],
}
METHOD_LABELS = {
    "cash": "Efectivo",
    "transfer": "Transferencia",
    "card": "Tarjeta",
    "other": "Otro",
}
WATERMARK_DRAFT = "BORRADOR - SIN VALIDEZ"
WATERMARK_TEST = "PRUEBA - SIN VALIDEZ"
WATERMARK_VOID = "ANULADO - SIN VALIDEZ"
WATERMARK_VIEW = "COPIA DE CONSULTA"

INK = colors.HexColor("#1B1F1D")
INK_2 = colors.HexColor("#4A524E")
LINE = colors.HexColor("#B9B4A8")
BAND = colors.HexColor("#DCEBE6")
BRAND = colors.HexColor("#0F5C4D")
SOFT = colors.HexColor("#F2F1EC")

# --- fonts -------------------------------------------------------------------

_FONTS: tuple[str, str] | None = None
_ASSET_FONTS = Path(__file__).resolve().parent.parent / "assets" / "fonts"


def fonts() -> tuple[str, str]:
    """``(regular, bold)`` font names. Embedded TrueType (DejaVu Sans if bundled under
    ``app/assets/fonts``, else Bitstream Vera shipped with ReportLab — both freely
    redistributable); Helvetica as last resort."""
    global _FONTS
    if _FONTS is not None:
        return _FONTS
    candidates = [
        ("DejaVuSans", _ASSET_FONTS / "DejaVuSans.ttf", _ASSET_FONTS / "DejaVuSans-Bold.ttf"),
        ("Vera", Path("Vera.ttf"), Path("VeraBd.ttf")),
    ]
    for name, regular, bold in candidates:
        try:
            pdfmetrics.registerFont(TTFont(name, str(regular)))
            pdfmetrics.registerFont(TTFont(f"{name}-Bold", str(bold)))
            pdfmetrics.registerFontFamily(name, normal=name, bold=f"{name}-Bold",
                                          italic=name, boldItalic=f"{name}-Bold")
        except Exception:
            continue
        _FONTS = (name, f"{name}-Bold")
        return _FONTS
    _FONTS = ("Helvetica", "Helvetica-Bold")
    return _FONTS


# --- small formatting helpers --------------------------------------------------

def esc(value: Any) -> str:
    return escape("" if value is None else str(value))


def fmt_qty(hundredths: Any) -> str:
    q = int(hundredths or 0)
    whole, frac = divmod(abs(q), 100)
    sign = "-" if q < 0 else ""
    if frac == 0:
        return f"{sign}{whole}"
    return f"{sign}{whole}.{frac:02d}".rstrip("0")


def fmt_rate(rate_bp: Any) -> str:
    bp = int(rate_bp or 0)
    whole, frac = divmod(bp, 100)
    return f"{whole} %" if frac == 0 else f"{whole}.{frac:02d}".rstrip("0") + " %"


def parse_dt(value: Any) -> datetime | date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime | date):
        return value
    text = str(value)
    if len(text) == 10:  # plain date: never shift it through a time zone
        try:
            return date.fromisoformat(text)
        except ValueError:
            return None
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        try:
            return date.fromisoformat(str(value)[:10])
        except ValueError:
            return None


def fmt_datetime(value: Any) -> str:
    dt = parse_dt(value)
    if dt is None:
        return str(value or "")
    if isinstance(dt, datetime):
        return to_hn(dt).strftime("%d/%m/%Y %H:%M")
    return dt.strftime("%d/%m/%Y")


def fmt_date(value: Any) -> str:
    dt = parse_dt(value)
    if dt is None:
        return str(value or "")
    if isinstance(dt, datetime):
        return to_hn(dt).strftime("%d/%m/%Y")
    return dt.strftime("%d/%m/%Y")


def _hex_color(value: Any, default: str = "#b91c1c") -> colors.Color:
    try:
        return colors.HexColor(str(value or default))
    except (ValueError, TypeError):
        return colors.HexColor(default)


def _d(obj: Any) -> dict[str, Any]:
    return obj if isinstance(obj, dict) else {}


# --- profile helpers -----------------------------------------------------------

def copy_labels_for(profile: Any) -> list[str]:
    return list(COPY_LABELS.get(getattr(profile, "copies_mode", ""), ["ORIGINAL"]))


def ensure_institutional_profile(profile: Any) -> None:
    if getattr(profile, "paper", "") in THERMAL_PAPERS:
        raise BusinessRuleError(
            "thermal_profile_not_allowed",
            "Los perfiles térmicos no son válidos para el recibo institucional.",
        )
    if not getattr(profile, "active", True):
        raise BusinessRuleError("print_profile_inactive", "El perfil de impresión está inactivo.")


# --- snapshot helpers ----------------------------------------------------------

def merge_snapshot(base: Mapping[str, Any], override: Mapping[str, Any] | None) -> dict[str, Any]:
    """Deep-merge: values present (non-None) in ``override`` win over ``base``."""
    out: dict[str, Any] = dict(base)
    for key, value in (override or {}).items():
        if value is None:
            continue
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = merge_snapshot(out[key], value)
        elif isinstance(value, list) and not value and out.get(key):
            continue  # an empty list never hides data rebuilt from the DB
        else:
            out[key] = value
    return out


def snapshot_from_models(
    *,
    invoice: Any = None,
    receipt: Any = None,
    series: Any = None,
    cashier_name: str = "",
    register_name: str = "",
    settings: Any = None,
) -> dict[str, Any]:
    """Build a snapshot from ORM rows (fallback for partial stored snapshots,
    and the source for draft/test receipts)."""
    snap: dict[str, Any] = {}
    if settings is not None:
        snap["institution"] = {
            k: getattr(settings, k, "")
            for k in ("hospital_name", "rtn", "address", "phone", "government_line",
                      "secretariat_line", "receipt_location", "receipt_footer_text")
        }
    if invoice is not None:
        snap["institution"] = {
            "hospital_name": invoice.hospital_name,
            "rtn": invoice.hospital_rtn,
            "address": invoice.hospital_address,
            "phone": invoice.hospital_phone,
            "government_line": invoice.government_line,
            "secretariat_line": invoice.secretariat_line,
            "receipt_location": invoice.receipt_location,
            "receipt_footer_text": invoice.receipt_footer_text,
        }
        snap["fiscal"] = {
            "cai": invoice.fiscal_cai,
            "range_from": invoice.fiscal_range_from,
            "range_to": invoice.fiscal_range_to,
            "valid_until": invoice.fiscal_valid_until.isoformat()
            if invoice.fiscal_valid_until else None,
        }
        snap["invoice"] = {
            "number": invoice.number,
            "issued_at": invoice.issued_at.isoformat() if invoice.issued_at else None,
            "patient_name": invoice.patient_name,
            "cashier_name": cashier_name,
            "register_name": register_name,
            "status": invoice.status,
        }
        snap["items"] = [
            {
                "name": it.service_name,
                "quantity_hundredths": it.quantity_hundredths,
                "unit_price_cents": it.unit_price_cents,
                "unit_price_registered_cents": it.unit_price_registered_cents,
                "rule_adjustment_cents": it.rule_adjustment_cents,
                "line_subtotal_cents": it.line_subtotal_cents,
                "tax_cents": it.tax_cents,
                "line_total_cents": it.line_total_cents,
                "special_rule_applied": it.special_rule_applied,
                "rate_bp": it.rate_bp,
            }
            for it in invoice.items
        ]
        snap["totals"] = {
            "subtotal_cents": invoice.subtotal_cents,
            "exempt_cents": invoice.exempt_cents,
            "taxable_cents": invoice.taxable_cents,
            "tax_cents": invoice.tax_cents,
            "total_cents": invoice.total_cents,
            "paid_cents": invoice.paid_cents,
            "balance_cents": invoice.balance_cents,
            "tax_breakdown": list(invoice.tax_breakdown or []),
        }
        snap["payments"] = [
            {
                "method": p.method,
                "reference": p.reference,
                "amount_cents": p.amount_cents,
                "paid_at": p.paid_at.isoformat() if p.paid_at else None,
            }
            for p in invoice.payments
            if p.status == "posted"
        ]
    if series is not None:
        snap["series"] = {
            "series": series.series,
            "prefix": series.prefix,
            "legal_text": series.legal_text,
            "number_color": series.number_color,
            "range_authorization": series.range_authorization,
        }
    if receipt is not None:
        snap["receipt"] = {
            "number_full": receipt.number_full,
            "amount_words": receipt.amount_words,
            "issued_at": receipt.issued_at.isoformat() if receipt.issued_at else None,
        }
    return snap


# --- layout --------------------------------------------------------------------

class _CopyMarker(Flowable):
    """Zero-size flowable that tells the page-end callback which copy is printing."""

    def __init__(self, label: str) -> None:
        super().__init__()
        self.label = label

    def wrap(self, _aw: float, _ah: float) -> tuple[float, float]:
        return 0, 0

    def draw(self) -> None:
        self.canv._shs_copy = self.label  # type: ignore[attr-defined]


class _Styles:
    def __init__(self, compact: bool) -> None:
        regular, bold = fonts()
        self.regular, self.bold = regular, bold
        base = 7.0 if compact else 8.5
        self.base = base
        lead = base * 1.22
        self.body = ParagraphStyle("body", fontName=regular, fontSize=base, leading=lead,
                                   textColor=INK)
        self.small = ParagraphStyle("small", parent=self.body, fontSize=base - 1,
                                    leading=(base - 1) * 1.2, textColor=INK_2)
        self.center = ParagraphStyle("center", parent=self.body, alignment=TA_CENTER)
        self.center_small = ParagraphStyle("cs", parent=self.small, alignment=TA_CENTER)
        self.hospital = ParagraphStyle("hospital", parent=self.center, fontName=bold,
                                       fontSize=base + 4, leading=(base + 4) * 1.15)
        self.label = ParagraphStyle("label", parent=self.small, fontName=bold)
        self.value = ParagraphStyle("value", parent=self.body)
        self.right = ParagraphStyle("right", parent=self.body, alignment=TA_RIGHT)
        self.bold_body = ParagraphStyle("bb", parent=self.body, fontName=bold)
        self.bold_right = ParagraphStyle("br", parent=self.right, fontName=bold)
        self.band = ParagraphStyle("band", parent=self.body, fontName=bold,
                                   fontSize=base + 2.5, leading=(base + 2.5) * 1.2,
                                   alignment=TA_LEFT)
        self.number = ParagraphStyle("number", parent=self.band, alignment=TA_RIGHT)
        self.section = ParagraphStyle("section", parent=self.body, fontName=bold,
                                      fontSize=base + 0.5, textColor=BRAND, spaceBefore=2)


def _page_size(profile: Any) -> tuple[float, float]:
    w = float(getattr(profile, "width_mm", 215.9) or 215.9)
    h = float(getattr(profile, "height_mm", 279.4) or 279.4)
    return w * mm, h * mm


def _header(snap: dict[str, Any], st: _Styles, width: float, logo: bytes | None) -> Table:
    inst = _d(snap.get("institution"))
    lines: list[Paragraph] = []
    for key in ("government_line", "secretariat_line"):
        if inst.get(key):
            lines.append(Paragraph(esc(inst[key]), st.center_small))
    lines.append(Paragraph(esc(inst.get("hospital_name") or "Hospital"), st.hospital))
    for key in ("address", "receipt_location"):
        if inst.get(key):
            lines.append(Paragraph(esc(inst[key]), st.center_small))
    contact = " · ".join(
        part for part in (
            f"RTN: {inst['rtn']}" if inst.get("rtn") else "",
            f"Tel. {inst['phone']}" if inst.get("phone") else "",
        ) if part
    )
    if contact:
        lines.append(Paragraph(esc(contact), st.center_small))

    side = 24 * mm
    logo_cell: Any = ""
    if logo:
        try:
            reader = ImageReader(io.BytesIO(logo))
            iw, ih = reader.getSize()
            box = side - 2 * mm
            scale = min(box / iw, box / ih)
            logo_cell = Image(io.BytesIO(logo), width=iw * scale, height=ih * scale)
        except Exception:
            logo_cell = ""
    table = Table([[logo_cell, lines, ""]], colWidths=[side, width - 2 * side, side])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, 0), "LEFT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return table


def _band(snap: dict[str, Any], st: _Styles, width: float, copy_label: str,
          reprint_no: int | None) -> Table:
    series = _d(snap.get("series"))
    receipt = _d(snap.get("receipt"))
    parts = ["RECIBO INSTITUCIONAL", f"<font size='{st.base + 0.5}'>{esc(copy_label)}</font>"]
    if reprint_no:
        parts.append(
            f"<font size='{st.base + 0.5}' color='#B42318'>REIMPRESIÓN #{reprint_no}</font>"
        )
    left = Paragraph(" · ".join(parts), st.band)
    color = _hex_color(series.get("number_color")).hexval().replace("0x", "#")
    number = esc(receipt.get("number_full") or "—")
    right = Paragraph(
        f"<font size='{st.base}' color='#4A524E'>Recibo No.</font> "
        f"<font color='{color}'>{number}</font>",
        st.number,
    )
    table = Table([[left, right]], colWidths=[width * 0.6, width * 0.4])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BAND),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -1), 1, BRAND),
    ]))
    return table


def _metadata(snap: dict[str, Any], st: _Styles, width: float) -> Table:
    inv = _d(snap.get("invoice"))
    fiscal = _d(snap.get("fiscal"))
    receipt = _d(snap.get("receipt"))
    rng = ""
    if fiscal.get("range_from") or fiscal.get("range_to"):
        rng = f"{fiscal.get('range_from') or ''} al {fiscal.get('range_to') or ''}"
    fields = [
        ("Factura", inv.get("number")),
        ("Fecha", fmt_datetime(receipt.get("issued_at") or inv.get("issued_at"))),
        ("Paciente", inv.get("patient_name")),
        ("Cajero", inv.get("cashier_name")),
        ("Caja", inv.get("register_name")),
        ("CAI", fiscal.get("cai")),
        ("Rango autorizado", rng),
        ("Fecha límite de emisión", fmt_date(fiscal.get("valid_until"))),
    ]
    pairs = 3 if width >= 240 * mm else 2
    label_w = 26 * mm if st.base < 8 else 30 * mm
    value_w = (width - pairs * label_w) / pairs
    rows: list[list[Any]] = []
    for i in range(0, len(fields), pairs):
        row: list[Any] = []
        for label, value in fields[i:i + pairs]:
            row += [Paragraph(esc(label), st.label), Paragraph(esc(value or "—"), st.value)]
        while len(row) < pairs * 2:
            row += ["", ""]
        rows.append(row)
    table = Table(rows, colWidths=[label_w, value_w] * pairs)
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, LINE),
    ]))
    return table


def _items(snap: dict[str, Any], st: _Styles, width: float) -> Table:
    num_w = [14 * mm, 24 * mm, 22 * mm, 26 * mm]
    desc_w = width - sum(num_w)
    head = [Paragraph(t, st.label if i == 0 else ParagraphStyle(
        f"h{i}", parent=st.label, alignment=TA_RIGHT))
        for i, t in enumerate(("Descripción", "Cant.", "Precio", "Ajuste", "Importe"))]
    rows: list[list[Any]] = [head]
    items = snap.get("items") or []
    for raw in items:
        it = _d(raw)
        name = esc(it.get("name") or it.get("service_name") or "")
        if it.get("special_rule_applied"):
            name += f" <font size='{st.base - 1}' color='#1E7A46'>· Sin cobro por receta</font>"
        registered = it.get("unit_price_registered_cents", it.get("unit_price_cents", 0)) or 0
        adjustment = int(it.get("rule_adjustment_cents") or 0)
        rows.append([
            Paragraph(name, st.body),
            Paragraph(fmt_qty(it.get("quantity_hundredths")), st.right),
            Paragraph(format_money(int(registered)), st.right),
            Paragraph(format_money(-adjustment) if adjustment else "—", st.right),
            Paragraph(format_money(int(it.get("line_subtotal_cents") or 0)), st.right),
        ])
    if not items:
        rows.append([Paragraph("Sin conceptos.", st.small), "", "", "", ""])
    table = Table(rows, colWidths=[desc_w, *num_w], repeatRows=1)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ("BACKGROUND", (0, 0), (-1, 0), SOFT),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, INK_2),
        ("LINEBELOW", (0, 1), (-1, -1), 0.25, LINE),
    ]
    table.setStyle(TableStyle(style))
    return table


def _totals_rows(snap: dict[str, Any]) -> list[tuple[str, int, bool]]:
    totals = _d(snap.get("totals"))
    rows: list[tuple[str, int, bool]] = [
        ("Subtotal", int(totals.get("subtotal_cents") or 0), False)
    ]
    rows.append(("Exento", int(totals.get("exempt_cents") or 0), False))
    taxed = [_d(b) for b in (totals.get("tax_breakdown") or []) if int(_d(b).get("rate_bp") or 0)]
    if taxed:
        for b in taxed:
            pct = fmt_rate(b.get("rate_bp"))
            rows.append((f"Gravado {pct}", int(b.get("base_cents") or 0), False))
            rows.append((f"ISV {pct}", int(b.get("tax_cents") or 0), False))
    else:
        rows.append(("Gravado 15 %", int(totals.get("taxable_cents") or 0), False))
        rows.append(("ISV 15 %", int(totals.get("tax_cents") or 0), False))
    rows.append(("Total", int(totals.get("total_cents") or 0), True))
    rows.append(("Pagado", int(totals.get("paid_cents") or 0), False))
    rows.append(("Saldo", int(totals.get("balance_cents") or 0), False))
    return rows


def _summary_block(snap: dict[str, Any], st: _Styles, width: float) -> Table:
    totals = _d(snap.get("totals"))
    receipt = _d(snap.get("receipt"))
    total = int(totals.get("total_cents") or 0)
    words = receipt.get("amount_words") or amount_in_words(max(total, 0))

    left: list[Any] = [
        Paragraph("Monto en letras", st.label),
        Paragraph(f"<b>{esc(words)}</b>", st.body),
        Spacer(0, 3),
        Paragraph("Pagos", st.label),
    ]
    payments = [_d(p) for p in (snap.get("payments") or []) if _d(p).get("status") != "void"]
    left_w = width * 0.58
    if payments:
        prow: list[list[Any]] = [[Paragraph("Método", st.small), Paragraph("Referencia", st.small),
                                  Paragraph("Monto", ParagraphStyle(
                                      "pm", parent=st.small, alignment=TA_RIGHT))]]
        for p in payments:
            prow.append([
                Paragraph(esc(METHOD_LABELS.get(str(p.get("method")), p.get("method") or "")),
                          st.body),
                Paragraph(esc(p.get("reference") or "—"), st.body),
                Paragraph(format_money(int(p.get("amount_cents") or 0)), st.right),
            ])
        ptable = Table(prow, colWidths=[left_w * 0.3, left_w * 0.4, left_w * 0.3 - 6])
        ptable.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 0.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0.5),
            ("LINEBELOW", (0, 0), (-1, 0), 0.25, LINE),
        ]))
        left.append(ptable)
    else:
        left.append(Paragraph("Sin pagos registrados (operación sin cobro).", st.small))

    trows: list[list[Any]] = []
    style: list[Any] = [
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 0.6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.6),
    ]
    for i, (label, cents, strong) in enumerate(_totals_rows(snap)):
        if strong:
            trows.append([Paragraph(label, st.bold_body),
                          Paragraph(format_money(cents), st.bold_right)])
            style += [("LINEABOVE", (0, i), (-1, i), 0.8, INK),
                      ("BACKGROUND", (0, i), (-1, i), SOFT)]
        else:
            trows.append([Paragraph(label, st.body), Paragraph(format_money(cents), st.right)])
    right_w = width - left_w - 4 * mm
    ttable = Table(trows, colWidths=[right_w * 0.55, right_w * 0.45])
    ttable.setStyle(TableStyle(style))

    outer = Table([[left, ttable]], colWidths=[left_w, width - left_w])
    outer.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (1, 0), (1, 0), 4 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    return outer


def _signatures(snap: dict[str, Any], st: _Styles, width: float, seal: bool) -> list[Any]:
    series = _d(snap.get("series"))
    totals = _d(snap.get("totals"))
    receipt = _d(snap.get("receipt"))
    inst = _d(snap.get("institution"))
    out: list[Any] = []
    legal = (series.get("legal_text") or "").strip()
    if legal:
        total = int(totals.get("total_cents") or 0)
        words = receipt.get("amount_words") or amount_in_words(max(total, 0))
        out.append(Paragraph(f"{esc(legal)} {esc(words)} ({format_money(total)}).", st.small))
    gap = (14 if seal else 9) * mm if st.base >= 8 else (10 if seal else 7) * mm
    cell_w = (width - 10 * mm) / 2
    sig = Table(
        [["", "", ""],
         [Paragraph("Firma del enterante", st.center_small), "",
          Paragraph("Sello y firma autorizada", st.center_small)]],
        colWidths=[cell_w, 10 * mm, cell_w],
        rowHeights=[gap, None],
    )
    sig.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (0, 0), 0.6, INK),
        ("LINEBELOW", (2, 0), (2, 0), 0.6, INK),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))
    out.append(sig)
    footer = (inst.get("receipt_footer_text") or "").strip()
    if footer:
        out.append(Spacer(0, 2))
        out.append(Paragraph(esc(footer), st.center_small))
    return out


def _receipt_story(snap: dict[str, Any], profile: Any, st: _Styles, width: float,
                   copy_label: str, reprint_no: int | None, logo: bytes | None) -> list[Any]:
    gap = 2.2 * mm if st.base >= 8 else 1.4 * mm
    story: list[Any] = [
        _CopyMarker(copy_label),
        _header(snap, st, width, logo),
        Spacer(0, gap),
        _band(snap, st, width, copy_label, reprint_no),
        Spacer(0, gap * 0.7),
        _metadata(snap, st, width),
        Spacer(0, gap * 0.7),
        Paragraph("Detalle de servicios", st.section),
        Spacer(0, 1),
        _items(snap, st, width),
        Spacer(0, gap * 0.6),
    ]
    tail = [_summary_block(snap, st, width), Spacer(0, gap * 0.8),
            *_signatures(snap, st, width, bool(getattr(profile, "show_seal_space", True)))]
    story.append(KeepTogether(tail))
    return story


def _draw_watermark(canvas: Canvas, text: str, page_w: float, page_h: float) -> None:
    _regular, bold = fonts()
    canvas.saveState()
    diagonal = (page_w**2 + page_h**2) ** 0.5
    size = min(min(page_w, page_h) / 9,
               diagonal * 0.75 / max(pdfmetrics.stringWidth(text, bold, 1), 1))
    canvas.setFont(bold, size)
    canvas.setFillColor(colors.HexColor("#B42318"))
    canvas.setFillAlpha(0.13)
    canvas.translate(page_w / 2, page_h / 2)
    canvas.rotate(math.degrees(math.atan2(page_h, page_w)))
    canvas.drawCentredString(0, -size / 3, text)
    canvas.restoreState()


def build_pdf(
    story: list[Any],
    page_size: tuple[float, float],
    margin: float,
    *,
    title: str,
    watermark: str | None = None,
    footer: Callable[[Canvas, BaseDocTemplate], None] | None = None,
) -> bytes:
    """Shared platypus wrapper (also used by report PDFs)."""
    buf = io.BytesIO()
    doc = BaseDocTemplate(
        buf, pagesize=page_size, leftMargin=margin, rightMargin=margin,
        topMargin=margin, bottomMargin=margin, title=title, author="S_Hospital",
        creator="S_Hospital", subject=title,
    )
    frame = Frame(margin, margin, page_size[0] - 2 * margin, page_size[1] - 2 * margin,
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id="body")

    def on_page(canvas: Canvas, _doc: BaseDocTemplate) -> None:
        if watermark:
            _draw_watermark(canvas, watermark, page_size[0], page_size[1])

    def on_page_end(canvas: Canvas, d: BaseDocTemplate) -> None:
        if footer is not None:
            footer(canvas, d)

    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=on_page,
                                       onPageEnd=on_page_end, pagesize=page_size)])
    doc.build(story)
    return buf.getvalue()


def render_institutional_receipt(
    snapshot: Mapping[str, Any],
    profile: Any,
    copy_labels: Iterable[str] | None = None,
    reprint_no: int | None = None,
    watermark: str | None = None,
    logo: bytes | None = None,
) -> bytes:
    """Render the institutional receipt; one page per copy label. Raises a 400
    ``BusinessRuleError`` for thermal profiles."""
    ensure_institutional_profile(profile)
    snap = dict(snapshot or {})
    labels = list(copy_labels or copy_labels_for(profile)) or ["ORIGINAL"]
    page_w, page_h = _page_size(profile)
    margin = float(getattr(profile, "margins_mm", 10) or 10) * mm
    width = page_w - 2 * margin
    st = _Styles(compact=page_h < 160 * mm)
    use_logo = logo if getattr(profile, "use_logo", True) else None

    story: list[Any] = []
    for i, label in enumerate(labels):
        if i:
            story.append(PageBreak())
        story += _receipt_story(snap, profile, st, width, label, reprint_no, use_logo)

    number = _d(snap.get("receipt")).get("number_full") or ""

    def footer(canvas: Canvas, doc: BaseDocTemplate) -> None:
        canvas.saveState()
        canvas.setFont(st.regular, max(st.base - 2, 5.5))
        canvas.setFillColor(INK_2)
        label = getattr(canvas, "_shs_copy", "")
        text = " · ".join(t for t in (f"Recibo {number}" if number else "", label,
                                      f"Página {doc.page}") if t)
        canvas.drawRightString(page_w - margin, margin * 0.45, text)
        canvas.restoreState()

    return build_pdf(story, (page_w, page_h), margin,
                     title=f"Recibo institucional {number}".strip(),
                     watermark=watermark, footer=footer)
