from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.permissions import ALL_PERMISSIONS, SYSTEM_ROLES
from app.core.security import verify_password
from app.models import (
    ERYTHROPOIETIN_RULE,
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
from app.seed.seeder import DEMO_PASSWORD, seed


def _counts(db: Session) -> dict[str, int]:
    models = [Role, Category, Area, Service, TaxRate, PrintProfile, ReceiptSeries, CashRegister,
              FiscalSequence, User, Setting]
    return {m.__name__: db.scalar(select(func.count()).select_from(m)) or 0 for m in models}


def test_base_seed_contents(db: Session) -> None:
    counts = _counts(db)
    assert counts["Service"] == 151
    assert counts["Role"] == 5
    assert counts["Area"] == 6
    assert counts["Category"] == 5
    assert counts["TaxRate"] == 2
    assert counts["PrintProfile"] == 7
    assert counts["ReceiptSeries"] == 1
    assert counts["CashRegister"] == 1
    assert counts["FiscalSequence"] == 0
    assert counts["User"] == 0

    settings = db.get(Setting, 1)
    assert settings is not None
    assert settings.hospital_name == "Hospital General"
    assert settings.rtn == ""
    assert settings.default_tax_rate_bp == 1500

    register = db.scalars(select(CashRegister)).one()
    assert (register.code, register.name) == ("principal", "Caja principal")


def test_roles_permissions(db: Session) -> None:
    for code, (name, perms) in SYSTEM_ROLES.items():
        role = db.scalar(select(Role).where(Role.code == code))
        assert role is not None and role.is_system and role.name == name
        assert role.permissions == perms
    admin = db.scalar(select(Role).where(Role.code == "admin"))
    assert admin is not None and admin.permissions == ALL_PERMISSIONS


def test_catalog_details(db: Session) -> None:
    epo = db.scalar(select(Service).where(Service.name == "Eritropoyetina"))
    assert epo is not None
    assert epo.special_rule_code == ERYTHROPOIETIN_RULE
    assert epo.price_cents == 2500
    assert epo.category.slug == "medicamentos"
    assert epo.area is not None and epo.area.name == "Farmacia"
    assert epo.rate_bp == 1500
    assert db.scalar(
        select(func.count(Service.id)).where(Service.special_rule_code.is_not(None))
    ) == 1

    anti_d = db.scalar(select(Service).where(Service.source_key ==
                                             "csv:service:servicios-generales:anti-d"))
    assert anti_d is not None and anti_d.price_cents == 85000
    assert anti_d.area is not None and anti_d.area.name == "Emergencia"

    radiology = db.scalar(select(Category).where(Category.slug == "radiologia"))
    assert radiology is not None
    areas = {s.area.name for s in db.scalars(select(Service).where(
        Service.category_id == radiology.id)) if s.area}
    assert areas == {"Rayos X"}

    isv = db.scalar(select(TaxRate).where(TaxRate.is_default.is_(True)))
    assert isv is not None and (isv.name, isv.rate_bp) == ("ISV 15 %", 1500)


def test_print_profiles_and_series(db: Session) -> None:
    default = db.scalars(select(PrintProfile).where(PrintProfile.is_default.is_(True))).one()
    assert default.code == "carta_vertical"
    half = db.scalar(select(PrintProfile).where(PrintProfile.code == "media_carta_horizontal"))
    assert half is not None
    assert (half.width_mm, half.height_mm, half.copies_mode) == (
        215.9, 139.7, "original_first_second")
    thermal = db.scalar(select(PrintProfile).where(PrintProfile.code == "thermal_80"))
    assert thermal is not None and thermal.active and not thermal.allowed_for_institutional

    series = db.scalars(select(ReceiptSeries)).one()
    assert (series.series, series.prefix, series.active) == ("REC-A", "RA", True)
    assert series.format_number(1) == "REC-A-00000001"
    assert series.number_color == "#b91c1c"


def test_seed_is_idempotent(db: Session) -> None:
    before = _counts(db)
    result = seed(db, demo=False)
    assert result.services_created == 0
    assert _counts(db) == before


def test_demo_seed_is_idempotent_and_preserves_edits(db: Session) -> None:
    seed(db, demo=True)
    first = _counts(db)
    assert first["User"] == 4
    assert first["FiscalSequence"] == 1
    settings = db.get(Setting, 1)
    assert settings is not None
    assert settings.hospital_name == "Hospital General San Isidro"
    assert settings.rtn == "08011999000001"
    seq = db.scalars(select(FiscalSequence)).one()
    assert seq.active and seq.active_marker == 1 and seq.cai.startswith("DEMO-CAI")

    cajero = db.scalar(select(User).where(User.username == "cajero"))
    assert cajero is not None and not cajero.must_change_password
    assert verify_password(cajero.password_hash, DEMO_PASSWORD)

    svc = db.scalar(select(Service).where(Service.name == "Eritropoyetina"))
    assert svc is not None
    svc.price_cents = 9900
    settings.hospital_name = "Hospital Editado"
    db.commit()

    seed(db, demo=True)
    assert _counts(db) == first
    db.refresh(svc)
    db.refresh(settings)
    assert svc.price_cents == 9900
    assert settings.hospital_name == "Hospital Editado"
