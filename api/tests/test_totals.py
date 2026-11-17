"""Pure unit tests for app.services.totals (SPEC §5 rules 1–2)."""

from __future__ import annotations

import itertools
import random

import pytest

from app.services.totals import (
    ERYTHROPOIETIN_RULE,
    LineInput,
    compute_totals,
    tax_label,
)

EPO = ERYTHROPOIETIN_RULE


def L(price: int, qty: int = 100, bp: int = 1500, rule: str | None = None) -> LineInput:
    return LineInput(price, qty, bp, rule)


def test_single_taxed_line() -> None:
    t = compute_totals([L(10_000)])
    assert (t.subtotal_cents, t.taxable_cents, t.exempt_cents) == (10_000, 10_000, 0)
    assert (t.tax_cents, t.total_cents) == (1_500, 11_500)
    assert t.lines[0].line_total_cents == 11_500
    assert t.tax_breakdown == [
        {"rate_bp": 1500, "base_cents": 10_000, "tax_cents": 1_500, "label": "ISV 15 %"}
    ]


def test_exempt_only() -> None:
    t = compute_totals([L(2_500, bp=0), L(1_000, qty=300, bp=0)])
    assert t.subtotal_cents == 5_500
    assert t.exempt_cents == 5_500
    assert t.taxable_cents == 0
    assert t.tax_cents == 0
    assert t.total_cents == 5_500
    assert t.tax_breakdown == [
        {"rate_bp": 0, "base_cents": 5_500, "tax_cents": 0, "label": "Exento"}
    ]


def test_mixed_rates_and_exempt() -> None:
    t = compute_totals([L(10_000, bp=1500), L(5_000, bp=1800), L(3_333, bp=0), L(1_001, bp=1500)])
    # group 18 %: 5000 -> 900; group 15 %: 11001 -> 1650.15 -> 1650
    assert t.taxable_cents == 16_001
    assert t.exempt_cents == 3_333
    assert t.tax_cents == 900 + 1_650
    assert t.total_cents == t.subtotal_cents + t.tax_cents
    assert [b["label"] for b in t.tax_breakdown] == ["ISV 18 %", "ISV 15 %", "Exento"]
    assert t.tax_breakdown[0]["tax_cents"] == 900
    assert t.tax_breakdown[1] == {
        "rate_bp": 1500, "base_cents": 11_001, "tax_cents": 1_650, "label": "ISV 15 %"
    }
    assert sum(x.line_total_cents for x in t.lines) == t.total_cents


def test_fractional_quantity_150_hundredths() -> None:
    t = compute_totals([L(3_333, qty=150, bp=0)])
    # 3333 * 1.5 = 4999.5 -> half-up 5000
    assert t.lines[0].line_subtotal_cents == 5_000
    assert t.total_cents == 5_000


def test_line_rounding_tie_rounds_half_up() -> None:
    t = compute_totals([L(1, qty=50, bp=0)])  # 0.5 cent -> 1
    assert t.lines[0].line_subtotal_cents == 1
    t = compute_totals([L(1, qty=49, bp=0)])  # 0.49 -> 0
    assert t.lines[0].line_subtotal_cents == 0


def test_group_tax_rounding_tie_half_up() -> None:
    # base 10 * 15 % = 1.5 cents -> 2
    t = compute_totals([L(10)])
    assert t.tax_cents == 2


def test_group_tax_is_computed_on_group_base_not_per_line() -> None:
    # Each line: 3 * 15% = 0.45 cent (floor 0). Group: 9 * 15% = 1.35 -> 1.
    t = compute_totals([L(3), L(3), L(3)])
    assert t.tax_cents == 1
    assert [x.tax_cents for x in t.lines] == [1, 0, 0]  # tie on residue -> lowest index
    assert t.total_cents == 10


def test_remainder_goes_to_largest_residue() -> None:
    # line0: 101*1500 = 151500 -> floor 15, residue 1500
    # line1: 107*1500 = 160500 -> floor 16, residue 500
    # line2: 105*1500 = 157500 -> floor 15, residue 7500
    # group: 313*1500 = 469500 -> (469500+5000)//10000 = 47; floors 46 -> 1 extra to line2
    t = compute_totals([L(101), L(107), L(105)])
    assert t.tax_cents == 47
    assert [x.tax_cents for x in t.lines] == [15, 16, 16]


def test_epo_line_free_only_with_prescription() -> None:
    lines = [L(250_000, bp=0, rule=EPO), L(10_000)]
    without = compute_totals(lines, dialysis_prescription=False)
    assert without.lines[0].line_subtotal_cents == 250_000
    assert not without.lines[0].special_rule_applied

    with_rx = compute_totals(lines, dialysis_prescription=True)
    epo = with_rx.lines[0]
    assert epo.special_rule_applied
    assert epo.unit_price_registered_cents == 250_000
    assert epo.unit_price_cents == 0
    assert epo.line_subtotal_cents == 0
    assert epo.rule_adjustment_cents == 250_000
    # the rest is charged normally: never a fully free invoice
    assert with_rx.total_cents == 11_500
    assert with_rx.lines[1].line_total_cents == 11_500


def test_epo_duplicate_lines_all_freed() -> None:
    lines = [L(1_000, qty=200, bp=0, rule=EPO), L(500), L(1_000, qty=150, bp=0, rule=EPO)]
    t = compute_totals(lines, dialysis_prescription=True)
    assert [x.special_rule_applied for x in t.lines] == [True, False, True]
    assert [x.rule_adjustment_cents for x in t.lines] == [2_000, 0, 1_500]
    assert t.rule_adjustment_cents == 3_500
    assert t.total_cents == 575


def test_epo_flag_without_eligible_line_frees_nothing() -> None:
    t = compute_totals([L(10_000), L(2_000, bp=0)], dialysis_prescription=True)
    assert not t.any_rule_applied
    assert t.rule_adjustment_cents == 0
    assert t.total_cents == 13_500


def test_taxed_epo_line_freed_has_no_tax_and_no_breakdown_entry() -> None:
    t = compute_totals([L(10_000, rule=EPO)], dialysis_prescription=True)
    assert t.total_cents == 0
    assert t.tax_cents == 0
    assert t.tax_breakdown == []
    assert t.any_rule_applied


def test_zero_total() -> None:
    t = compute_totals([L(0), L(0, bp=0)])
    assert t.total_cents == 0
    assert t.subtotal_cents == 0
    assert t.tax_breakdown == []


def test_invalid_inputs() -> None:
    with pytest.raises(ValueError):
        compute_totals([L(100, qty=0)])
    with pytest.raises(ValueError):
        compute_totals([L(-1)])
    with pytest.raises(ValueError):
        compute_totals([L(100, bp=10_000)])


def test_tax_label() -> None:
    assert tax_label(1500) == "ISV 15 %"
    assert tax_label(1800) == "ISV 18 %"
    assert tax_label(1250) == "ISV 12.5 %"
    assert tax_label(1525) == "ISV 15.25 %"


def test_empty_lines() -> None:
    t = compute_totals([])
    assert t.total_cents == 0
    assert t.lines == []


@pytest.mark.parametrize("seed", range(30))
def test_invariants_random(seed: int) -> None:
    rng = random.Random(seed)
    lines = [
        L(rng.randint(0, 500_000), rng.randint(1, 5_000), rng.choice([0, 1500, 1800, 1250]),
          rng.choice([None, None, EPO]))
        for _ in range(rng.randint(1, 40))
    ]
    for rx in (False, True):
        t = compute_totals(lines, dialysis_prescription=rx)
        assert sum(x.line_total_cents for x in t.lines) == t.total_cents
        assert t.total_cents == t.subtotal_cents + t.tax_cents
        assert t.exempt_cents + t.taxable_cents == t.subtotal_cents
        assert sum(b["tax_cents"] for b in t.tax_breakdown) == t.tax_cents
        assert sum(b["base_cents"] for b in t.tax_breakdown) == t.subtotal_cents
        for bp, group in itertools.groupby(
            sorted((x for x in t.lines if x.rate_bp), key=lambda x: x.rate_bp),
            key=lambda x: x.rate_bp,
        ):
            g = list(group)
            base = sum(x.line_subtotal_cents for x in g)
            assert sum(x.tax_cents for x in g) == (base * bp + 5000) // 10000
            for x in g:
                floor = x.line_subtotal_cents * bp // 10000
                assert x.tax_cents in (floor, floor + 1)
        for x, src in zip(t.lines, lines, strict=True):
            freed = rx and src.special_rule_code == EPO
            assert x.special_rule_applied is freed
            full = (src.unit_price_registered_cents * src.quantity_hundredths + 50) // 100
            assert x.line_subtotal_cents + x.rule_adjustment_cents == full
