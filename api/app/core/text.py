"""Text helpers: slugs, accent-insensitive search keys, whitespace collapsing."""

from __future__ import annotations

import re
import unicodedata


def strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )


def slugify(text: str, max_length: int = 140) -> str:
    """``"Rayos X - Tórax"`` -> ``"rayos-x-torax"``."""
    s = strip_accents(text).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:max_length].strip("-") or "item"


def search_key(text: str) -> str:
    """Lowercase, accent-free, single-spaced text for comparisons/search."""
    return collapse_spaces(strip_accents(text).lower())


def collapse_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()
