from decimal import Decimal

import pytest

from app.core.money import amount_in_words, format_money, parse_money


@pytest.mark.parametrize(
    ("text", "cents"),
    [
        ("1,234.50", 123450),
        ("L 1,234.50", 123450),
        ("0", 0),
        ("10.5", 1050),
        ("25", 2500),
        (" 1 000.01 ", 100001),
        (3, 300),
        (Decimal("2.25"), 225),
    ],
)
def test_parse_money(text: str, cents: int) -> None:
    assert parse_money(text) == cents


@pytest.mark.parametrize("bad", ["", "abc", "1.234", "-5", "1,2,3.x", "NaN"])
def test_parse_money_rejects(bad: str) -> None:
    with pytest.raises(ValueError):
        parse_money(bad)


def test_parse_money_negative_allowed() -> None:
    assert parse_money("-5.25", allow_negative=True) == -525


@pytest.mark.parametrize(
    ("cents", "text"),
    [(0, "L 0.00"), (5, "L 0.05"), (123450, "L 1,234.50"), (100000000, "L 1,000,000.00"),
     (-2500, "-L 25.00")],
)
def test_format_money(cents: int, text: str) -> None:
    assert format_money(cents) == text


def test_format_money_without_symbol() -> None:
    assert format_money(123450, symbol=False) == "1,234.50"


@pytest.mark.parametrize(
    ("cents", "words"),
    [
        (0, "CERO LEMPIRAS CON 00/100"),
        (5, "CERO LEMPIRAS CON 05/100"),
        (100, "UN LEMPIRA CON 00/100"),
        (199, "UN LEMPIRA CON 99/100"),
        (1500, "QUINCE LEMPIRAS CON 00/100"),
        (2100, "VEINTIÚN LEMPIRAS CON 00/100"),
        (2250, "VEINTIDÓS LEMPIRAS CON 50/100"),
        (3100, "TREINTA Y UN LEMPIRAS CON 00/100"),
        (10000, "CIEN LEMPIRAS CON 00/100"),
        (10100, "CIENTO UN LEMPIRAS CON 00/100"),
        (50000, "QUINIENTOS LEMPIRAS CON 00/100"),
        (100000, "UN MIL LEMPIRAS CON 00/100"),
        (123405, "UN MIL DOSCIENTOS TREINTA Y CUATRO LEMPIRAS CON 05/100"),
        (2100000, "VEINTIÚN MIL LEMPIRAS CON 00/100"),
        (10100000, "CIENTO UN MIL LEMPIRAS CON 00/100"),
        (100000000, "UN MILLÓN DE LEMPIRAS CON 00/100"),
        (100000100, "UN MILLÓN UN LEMPIRAS CON 00/100"),
        (250000000, "DOS MILLONES QUINIENTOS MIL LEMPIRAS CON 00/100"),
        (300000000, "TRES MILLONES DE LEMPIRAS CON 00/100"),
        (
            99999999,
            "NOVECIENTOS NOVENTA Y NUEVE MIL NOVECIENTOS NOVENTA Y NUEVE LEMPIRAS CON 99/100",
        ),
    ],
)
def test_amount_in_words(cents: int, words: str) -> None:
    assert amount_in_words(cents) == words


def test_amount_in_words_rejects_negative() -> None:
    with pytest.raises(ValueError):
        amount_in_words(-1)
