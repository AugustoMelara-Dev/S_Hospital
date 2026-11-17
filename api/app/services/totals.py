"""Pure invoice totals (SPEC §5 rules 1–2). No database access.

Per line::

    registered      = catalog price_cents
    unit            = 0 if the erythropoietin rule applies, else registered
    line_subtotal   = (unit * qty_hundredths + 50) // 100
    rule_adjustment = (registered * qty_hundredths + 50) // 100 - line_subtotal

Tax (ISV) is computed per rate group over the group's whole base
(``(base * bp + 5000) // 10000``) and distributed to its lines with
``floor(base_line * bp / 10000)``; the leftover cents go to the lines with the
largest residue (``base_line * bp % 10000`` desc, ties by line index).

``exempt = subtotal - taxable``; ``total = subtotal + tax``; Σ line_total == total.
The erythropoietin rule only frees lines whose ``special_rule_code`` is
``ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`` and only when the invoice carries
``dialysis_prescription=True``; every other line is charged normally.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.models.catalog import ERYTHROPOIETIN_RULE


@dataclass(frozen=True)
class LineInput:
    unit_price_registered_cents: int
    quantity_hundredths: int
    rate_bp: int = 0
    special_rule_code: str | None = None


@dataclass
class LineTotals:
    unit_price_registered_cents: int
    unit_price_cents: int
    quantity_hundredths: int
    rule_adjustment_cents: int
    rate_bp: int
    line_subtotal_cents: int
    tax_cents: int
    line_total_cents: int
    special_rule_applied: bool


@dataclass
class Totals:
    lines: list[LineTotals]
    subtotal_cents: int
    exempt_cents: int
    taxable_cents: int
    tax_cents: int
    total_cents: int
    tax_breakdown: list[dict[str, Any]] = field(default_factory=list)

    @property
    def rule_adjustment_cents(self) -> int:
        return sum(line.rule_adjustment_cents for line in self.lines)

    @property
    def any_rule_applied(self) -> bool:
        return any(line.special_rule_applied for line in self.lines)


def tax_label(rate_bp: int) -> str:
    """``1500 -> "ISV 15 %"``, ``1250 -> "ISV 12.5 %"``."""
    whole, frac = divmod(rate_bp, 100)
    pct = str(whole) if frac == 0 else f"{whole}.{frac:02d}".rstrip("0")
    return f"ISV {pct} %"


def _round_hundredths(value: int) -> int:
    """Half-up rounding of a non-negative value expressed in hundredths."""
    return (value + 50) // 100


def compute_totals(lines: list[LineInput], dialysis_prescription: bool = False) -> Totals:
    out: list[LineTotals] = []
    for line in lines:
        if line.quantity_hundredths < 1:
            raise ValueError("La cantidad debe ser mayor que cero.")
        if line.unit_price_registered_cents < 0:
            raise ValueError("El precio no puede ser negativo.")
        if not 0 <= line.rate_bp <= 9999:
            raise ValueError("Tasa de impuesto inválida.")
        applied = dialysis_prescription and line.special_rule_code == ERYTHROPOIETIN_RULE
        registered = line.unit_price_registered_cents
        unit = 0 if applied else registered
        qty = line.quantity_hundredths
        subtotal = _round_hundredths(unit * qty)
        adjustment = _round_hundredths(registered * qty) - subtotal
        out.append(LineTotals(
            unit_price_registered_cents=registered,
            unit_price_cents=unit,
            quantity_hundredths=qty,
            rule_adjustment_cents=adjustment,
            rate_bp=line.rate_bp,
            line_subtotal_cents=subtotal,
            tax_cents=0,
            line_total_cents=subtotal,
            special_rule_applied=applied,
        ))

    # Group by tax rate (exempt lines have rate 0 and no tax).
    groups: dict[int, list[int]] = {}
    for idx, line in enumerate(out):
        if line.rate_bp > 0:
            groups.setdefault(line.rate_bp, []).append(idx)

    breakdown: list[dict[str, Any]] = []
    taxable = 0
    tax_total = 0
    for bp in sorted(groups, reverse=True):
        idxs = groups[bp]
        base = sum(out[i].line_subtotal_cents for i in idxs)
        group_tax = (base * bp + 5000) // 10000
        floors = {i: out[i].line_subtotal_cents * bp // 10000 for i in idxs}
        remaining = group_tax - sum(floors.values())
        by_residue = sorted(idxs, key=lambda i: (-(out[i].line_subtotal_cents * bp % 10000), i))
        for i in by_residue[:remaining]:
            floors[i] += 1
        for i in idxs:
            out[i].tax_cents = floors[i]
            out[i].line_total_cents = out[i].line_subtotal_cents + floors[i]
        taxable += base
        tax_total += group_tax
        if base > 0:
            breakdown.append(
                {"rate_bp": bp, "base_cents": base, "tax_cents": group_tax, "label": tax_label(bp)}
            )

    subtotal_all = sum(line.line_subtotal_cents for line in out)
    exempt = subtotal_all - taxable
    if exempt > 0:
        breakdown.append({"rate_bp": 0, "base_cents": exempt, "tax_cents": 0, "label": "Exento"})
    total = subtotal_all + tax_total
    if sum(line.line_total_cents for line in out) != total:  # pragma: no cover - invariant
        raise AssertionError("Invariante de totales violada: Σ líneas != total")
    return Totals(
        lines=out,
        subtotal_cents=subtotal_all,
        exempt_cents=exempt,
        taxable_cents=taxable,
        tax_cents=tax_total,
        total_cents=total,
        tax_breakdown=breakdown,
    )
