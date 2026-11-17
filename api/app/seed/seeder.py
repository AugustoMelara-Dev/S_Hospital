"""Idempotent seeder (``python -m app.cli seed [--demo]``).

Base data: system roles + permissions, cash register "Caja principal", settings
singleton, tax rates, areas, categories + services from ``catalogo_servicios.csv``,
print profiles and receipt series REC-A. ``demo=True`` adds demo institution data,
an active demo fiscal sequence and demo users (password ``Hospital#2026``).

Re-running never duplicates rows. Existing services are NOT overwritten (to keep
admin price/tax changes); only ``special_rule_code`` is re-asserted from the CSV.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.money import parse_money
from app.core.permissions import SYSTEM_ROLES
from app.core.security import hash_password
from app.core.text import slugify
from app.core.timeutil import hn_today
from app.models import (
    ERYTHROPOIETIN_RULE,
    SETTINGS_ID,
    Area,
    CashRegister,
    Category,
    FiscalSequence,
    PrintProfile,
    ReceiptSeries,
    Role,
    Service,
    Setting,
    TaxRate,
    User,
)

CATALOG_CSV = Path(__file__).with_name("catalogo_servicios.csv")
DEMO_PASSWORD = "Hospital#2026"

SPECIAL_RULES = {"eritropoyetina_gratis_con_receta_dialisis": ERYTHROPOIETIN_RULE}

AREAS = ["Laboratorio", "Rayos X", "Emergencia", "Consulta externa", "Farmacia", "Otros"]
CATEGORY_AREA = {
    "laboratorio": "Laboratorio",
    "radiologia": "Rayos X",
    "servicios-generales": "Emergencia",
    "medicamentos": "Farmacia",
    "odontologia": "Consulta externa",
}
ISV_NAME = "ISV 15 %"
EXEMPT_NAME = "Exento 0 %"

# code, name, paper, width, height, margins, copies_mode, active, default
PRINT_PROFILES: list[tuple[str, str, str, float, float, float, str, bool, bool]] = [
    ("media_carta_horizontal", "Media carta horizontal", "half_letter", 215.9, 139.7, 8,
     "original_first_second", True, False),
    ("carta_vertical", "Carta vertical", "letter_portrait", 215.9, 279.4, 12,
     "original_only", True, True),
    ("carta_horizontal", "Carta horizontal", "letter_landscape", 279.4, 215.9, 12,
     "original_only", True, False),
    ("a5_horizontal", "A5 horizontal", "a5_landscape", 210, 148, 8, "original_only", True, False),
    ("a4_vertical", "A4 vertical", "a4_portrait", 210, 297, 12, "original_only", True, False),
    ("thermal_80", "Térmica 80 mm", "thermal_80", 80, 200, 3, "original_only", True, False),
    ("thermal_58", "Térmica 58 mm", "thermal_58", 58, 200, 2, "original_only", True, False),
]

DEMO_SETTINGS = {
    "hospital_name": "Hospital General San Isidro",
    "rtn": "08011999000001",
    "address": "Barrio El Centro, Tocoa, Colón",
    "phone": "2444-0000",
    "government_line": "Gobierno de Honduras",
    "secretariat_line": "Secretaría de Salud Pública",
    "receipt_location": "Tocoa, Colón",
}

DEMO_USERS = [
    ("admin", "Administración Demo", "admin"),
    ("supervisor", "Supervisión Demo", "supervisor"),
    ("cajero", "Cajero Demo", "cajero"),
    ("auditor", "Auditoría Demo", "auditor"),
]


@dataclass
class SeedResult:
    roles: int = 0
    categories: int = 0
    areas: int = 0
    services: int = 0
    services_created: int = 0
    users: int = 0

    def as_dict(self) -> dict[str, int]:
        return dict(self.__dict__)


def _yes(value: str) -> bool:
    return value.strip().lower() in ("si", "sí", "yes", "true", "1")


def seed_roles(db: Session) -> None:
    for code, (name, perms) in SYSTEM_ROLES.items():
        role = db.scalar(select(Role).where(Role.code == code))
        if role is None:
            role = Role(code=code, name=name, is_system=True)
            db.add(role)
        role.name = name
        role.is_system = True
        role.set_permissions(perms)
    db.flush()


def seed_settings(db: Session, demo: bool) -> Setting:
    s = db.get(Setting, SETTINGS_ID)
    if s is None:
        s = Setting(id=SETTINGS_ID, hospital_name="Hospital General", default_tax_rate_bp=1500)
        db.add(s)
    if demo:
        for field, value in DEMO_SETTINGS.items():
            current = getattr(s, field)
            if not current or (field == "hospital_name" and current == "Hospital General"):
                setattr(s, field, value)
    db.flush()
    return s


def seed_tax_rates(db: Session) -> TaxRate:
    rates: dict[str, TaxRate] = {}
    for name, bp, default in ((ISV_NAME, 1500, True), (EXEMPT_NAME, 0, False)):
        rate = db.scalar(select(TaxRate).where(TaxRate.name == name))
        if rate is None:
            rate = TaxRate(name=name, rate_bp=bp, active=True, is_default=default)
            db.add(rate)
        rates[name] = rate
    db.flush()
    return rates[ISV_NAME]


def seed_areas(db: Session) -> dict[str, Area]:
    out: dict[str, Area] = {}
    for idx, name in enumerate(AREAS):
        slug = slugify(name)
        area = db.scalar(select(Area).where(Area.slug == slug))
        if area is None:
            area = Area(name=name, slug=slug, active=True, sort_order=idx + 1)
            db.add(area)
        out[name] = area
    db.flush()
    return out


def read_catalog_csv(path: Path = CATALOG_CSV) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def seed_catalog(db: Session, isv: TaxRate, areas: dict[str, Area]) -> int:
    """Create missing categories/services from the CSV. Returns services created."""
    rows = read_catalog_csv()
    categories: dict[str, Category] = {}
    for row in rows:
        name = row["categoria"].strip()
        slug = slugify(name)
        if slug in categories:
            continue
        cat = db.scalar(select(Category).where(Category.slug == slug))
        if cat is None:
            cat = Category(name=name, slug=slug, active=True, sort_order=len(categories) + 1)
            db.add(cat)
        categories[slug] = cat
    db.flush()

    created = 0
    for row in rows:
        source_key = row["source_key"].strip()
        rule = SPECIAL_RULES.get(row["regla_especial"].strip()) if row["regla_especial"] else None
        existing = db.scalar(select(Service).where(Service.source_key == source_key))
        if existing is not None:
            existing.special_rule_code = rule
            continue
        cat_slug = slugify(row["categoria"].strip())
        area_name = CATEGORY_AREA.get(cat_slug)
        db.add(
            Service(
                category_id=categories[cat_slug].id,
                area_id=areas[area_name].id if area_name else None,
                name=row["servicio"].strip(),
                slug=source_key.rsplit(":", 1)[-1] or slugify(row["servicio"]),
                source_key=source_key,
                aliases=(row.get("aliases") or "").strip(),
                description=(row.get("descripcion") or "").strip()[:255],
                price_cents=parse_money(row["precio_lps"]),
                tax_rate_id=isv.id if _yes(row["taxable"]) else None,
                active=_yes(row["activo"]),
                visible_in_billing=_yes(row["visible_en_cobro"]),
                is_billable=_yes(row["facturable"]),
                special_rule_code=rule,
            )
        )
        created += 1
    db.flush()
    return created


def seed_cash_register(db: Session) -> None:
    if db.scalar(select(CashRegister).where(CashRegister.code == "principal")) is None:
        db.add(CashRegister(code="principal", name="Caja principal", active=True))
        db.flush()


def seed_print_profiles(db: Session) -> None:
    has_default = db.scalar(select(PrintProfile).where(PrintProfile.is_default.is_(True)))
    for code, name, paper, w, h, m, copies, active, default in PRINT_PROFILES:
        if db.scalar(select(PrintProfile).where(PrintProfile.code == code)) is not None:
            continue
        profile = PrintProfile(
            code=code, name=name, paper=paper, width_mm=w, height_mm=h, margins_mm=m,
            copies_mode=copies, show_seal_space=not paper.startswith("thermal"),
            use_logo=True, active=active,
        )
        profile.set_default(default and has_default is None)
        db.add(profile)
    db.flush()


def seed_receipt_series(db: Session) -> None:
    if db.scalar(select(ReceiptSeries).where(ReceiptSeries.series == "REC-A")) is not None:
        return
    has_active = db.scalar(select(ReceiptSeries).where(ReceiptSeries.active.is_(True)))
    series = ReceiptSeries(
        series="REC-A", prefix="RA", min_number=1, max_number=99_999_999, current_number=0,
        range_authorization="",
        legal_text="Suscribe. CERTIFICA haber enterado en esta oficina la suma de",
        number_color="#b91c1c",
    )
    series.set_active(has_active is None)
    db.add(series)
    db.flush()


def seed_demo_fiscal_sequence(db: Session) -> None:
    if db.scalar(select(func.count(FiscalSequence.id))):
        return
    seq = FiscalSequence(
        prefix="000-001-01",
        cai="DEMO-CAI-0000-0000-0000-0000-00",
        min_number=1,
        max_number=99_999_999,
        current_number=0,
        valid_until=hn_today() + timedelta(days=365),
    )
    seq.set_active(True)
    db.add(seq)
    db.flush()


def seed_demo_users(db: Session) -> None:
    password_hash: str | None = None
    for username, name, role_code in DEMO_USERS:
        if db.scalar(select(User).where(User.username == username)) is not None:
            continue
        role = db.scalar(select(Role).where(Role.code == role_code))
        assert role is not None
        password_hash = password_hash or hash_password(DEMO_PASSWORD)
        db.add(User(name=name, username=username, password_hash=password_hash, role_id=role.id,
                    active=True, must_change_password=False))
    db.flush()


def seed(db: Session, demo: bool = False, *, commit: bool = True) -> SeedResult:
    seed_roles(db)
    seed_cash_register(db)
    seed_settings(db, demo)
    isv = seed_tax_rates(db)
    areas = seed_areas(db)
    created = seed_catalog(db, isv, areas)
    seed_print_profiles(db)
    seed_receipt_series(db)
    if demo:
        seed_demo_fiscal_sequence(db)
        seed_demo_users(db)
    if commit:
        db.commit()

    def count(model: Any) -> int:
        return db.scalar(select(func.count()).select_from(model)) or 0

    return SeedResult(
        roles=count(Role), categories=count(Category), areas=count(Area),
        services=count(Service), services_created=created, users=count(User),
    )
