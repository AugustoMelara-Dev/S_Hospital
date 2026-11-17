"""Money helpers. Money is ALWAYS integer cents (HNL centavos), never floats.

- ``parse_money("1,234.50") -> 123450``
- ``format_money(123450) -> "L 1,234.50"``
- ``amount_in_words(123405) -> "UN MIL DOSCIENTOS TREINTA Y CUATRO LEMPIRAS CON 05/100"``
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation


def parse_money(value: str | int | Decimal, *, allow_negative: bool = False) -> int:
    """Parse a Lempira amount ("1,234.50", "L 25", "10.5") into integer cents.

    Raises ``ValueError`` (Spanish message) on invalid input or more than 2 decimals.
    """
    if isinstance(value, bool):
        raise ValueError("Monto inválido.")
    if isinstance(value, int):
        dec = Decimal(value)
    elif isinstance(value, Decimal):
        dec = value
    else:
        text = str(value).strip()
        if text.upper().startswith("L"):
            text = text[1:]
        text = text.replace(",", "").replace(" ", "")
        if not text:
            raise ValueError("Monto inválido.")
        try:
            dec = Decimal(text)
        except InvalidOperation as exc:
            raise ValueError("Monto inválido.") from exc
    if not dec.is_finite():
        raise ValueError("Monto inválido.")
    scaled = dec * 100
    if scaled != scaled.to_integral_value():
        raise ValueError("El monto admite como máximo 2 decimales.")
    cents = int(scaled)
    if cents < 0 and not allow_negative:
        raise ValueError("El monto no puede ser negativo.")
    return cents


def format_money(cents: int, *, symbol: bool = True) -> str:
    """Format cents as ``"L 1,234.50"`` (negative: ``"-L 1,234.50"``)."""
    sign = "-" if cents < 0 else ""
    whole, frac = divmod(abs(int(cents)), 100)
    body = f"{whole:,}.{frac:02d}"
    return f"{sign}L {body}" if symbol else f"{sign}{body}"


_UNITS = [
    "CERO", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE",
    "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE",
    "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS",
    "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE",
]
_TENS = [
    "", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA",
]
_HUNDREDS = [
    "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
    "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS",
]


def _apocope(words: str) -> str:
    """Before a noun 'UNO' becomes 'UN' (VEINTIUNO -> VEINTIÚN)."""
    if words.endswith("VEINTIUNO"):
        return words[: -len("VEINTIUNO")] + "VEINTIÚN"
    if words == "UNO" or words.endswith(" UNO"):
        return words[:-1]
    return words


def _below_1000(n: int) -> str:
    if n < 30:
        return _UNITS[n]
    if n < 100:
        tens, unit = divmod(n, 10)
        return _TENS[tens] + (f" Y {_UNITS[unit]}" if unit else "")
    if n == 100:
        return "CIEN"
    hundreds, rest = divmod(n, 100)
    return _HUNDREDS[hundreds] + (f" {_below_1000(rest)}" if rest else "")


def number_to_words(n: int) -> str:
    """Spanish cardinal in uppercase, apocopated as used before 'LEMPIRAS'."""
    if n < 0:
        raise ValueError("Número negativo.")
    if n == 0:
        return "CERO"
    millions, rest = divmod(n, 1_000_000)
    thousands, units = divmod(rest, 1000)
    parts: list[str] = []
    if millions:
        if millions >= 1_000_000:
            raise ValueError("Monto fuera de rango.")
        if millions == 1:
            parts.append("UN MILLÓN")
        else:
            parts.append(f"{number_to_words(millions)} MILLONES")
    if thousands:
        # Honduran receipts write "UN MIL" (see SPEC example).
        parts.append("UN MIL" if thousands == 1 else f"{_apocope(_below_1000(thousands))} MIL")
    if units:
        parts.append(_apocope(_below_1000(units)))
    return " ".join(parts)


def amount_in_words(cents: int) -> str:
    """``123405 -> "UN MIL DOSCIENTOS TREINTA Y CUATRO LEMPIRAS CON 05/100"``."""
    if cents < 0:
        raise ValueError("El monto no puede ser negativo.")
    whole, frac = divmod(int(cents), 100)
    words = number_to_words(whole)
    if whole and whole % 1_000_000 == 0:
        words += " DE"
    currency = "LEMPIRA" if whole == 1 else "LEMPIRAS"
    return f"{words} {currency} CON {frac:02d}/100"
