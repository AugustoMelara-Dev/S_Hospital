"""Catalog: categories, areas, services, price history, bulk tax, CSV/XLSX export
and CSV import (preview/apply).

Rules (SPEC §5):
- Price, tax and availability changes need a reason (>= 5) and write audit rows;
  price changes also write ``service_price_history``.
- ``special_rule_code`` cannot be created, changed nor removed through the API
  (schemas forbid the field; import never touches it).
- Search is accent/case-insensitive over name + aliases (done in Python so it
  behaves the same on SQLite and MariaDB; the catalog is small).
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from fastapi import Request
from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.errors import BusinessRuleError, ConflictError, NotFoundError, ValidationFailedError
from app.core.money import parse_money
from app.core.pagination import PageQuery
from app.core.text import collapse_spaces, search_key, slugify
from app.core.timeutil import hn_today
from app.models.catalog import Area, Category, Service, ServicePriceHistory
from app.models.settings import TaxRate
from app.models.users import User
from app.schemas.catalog import (
    BulkTaxIn,
    GroupIn,
    GroupOut,
    ImportLine,
    ImportReport,
    ImportSummary,
    PriceHistoryOut,
    Ref,
    ServiceIn,
    ServiceOut,
    ServicePatch,
)
from app.services.settings import default_tax_rate, require_reason

GroupModel = type[Category] | type[Area]

# --- categories / areas -------------------------------------------------------------

_GROUP_LABEL = {Category: ("category", "La categoría"), Area: ("area", "El área")}


def _group_label(model: GroupModel) -> tuple[str, str]:
    return _GROUP_LABEL[model]


def list_groups(db: Session, model: GroupModel, active: bool | None) -> list[GroupOut]:
    fk = Service.category_id if model is Category else Service.area_id
    counts = dict(
        db.execute(select(fk, func.count(Service.id)).where(fk.is_not(None)).group_by(fk)).all()
    )
    stmt = select(model).order_by(model.sort_order, model.name)
    if active is not None:
        stmt = stmt.where(model.active.is_(active))
    out = []
    for g in db.scalars(stmt):
        item = GroupOut.model_validate(g)
        item.services_count = int(counts.get(g.id, 0))
        out.append(item)
    return out


def group_out(db: Session, model: GroupModel, g: Category | Area) -> GroupOut:
    fk = Service.category_id if model is Category else Service.area_id
    item = GroupOut.model_validate(g)
    item.services_count = db.scalar(select(func.count(Service.id)).where(fk == g.id)) or 0
    return item


def get_group(db: Session, model: GroupModel, group_id: int) -> Category | Area:
    g = db.get(model, group_id)
    if g is None:
        code, label = _group_label(model)
        raise NotFoundError(f"{code}_not_found", f"{label} no existe.")
    return g


def _ensure_group_slug_free(
    db: Session, model: GroupModel, slug: str, exclude_id: int | None = None
) -> None:
    other = db.scalar(select(model).where(model.slug == slug))
    if other is not None and other.id != exclude_id:
        code, _ = _group_label(model)
        raise ConflictError(f"{code}_duplicate", "Ya existe un registro con ese nombre.")


def create_group(
    db: Session, user: User, model: GroupModel, data: GroupIn, request: Request | None
) -> Category | Area:
    name = collapse_spaces(data.name)
    slug = slugify(name)
    _ensure_group_slug_free(db, model, slug)
    g = model(name=name, slug=slug, active=data.active, sort_order=data.sort_order)
    db.add(g)
    db.flush()
    code, _ = _group_label(model)
    audit(db, user, f"{code}.created", entity=g,
          new={"name": g.name, "active": g.active, "sort_order": g.sort_order}, request=request)
    db.commit()
    return g


def update_group(
    db: Session, user: User, model: GroupModel, group_id: int, data: Any,
    request: Request | None,
) -> Category | Area:
    g = get_group(db, model, group_id)
    values = {k: v for k, v in data.model_dump(exclude_unset=True, exclude={"reason"}).items()
              if v is not None}
    if "name" in values:
        values["name"] = collapse_spaces(values["name"])
    old = {"name": g.name, "active": g.active, "sort_order": g.sort_order}
    changed = {k: v for k, v in values.items() if old[k] != v}
    if not changed:
        return g
    reason = data.reason
    if "active" in changed:
        reason = require_reason(data.reason)
    if "name" in changed:
        slug = slugify(changed["name"])
        _ensure_group_slug_free(db, model, slug, exclude_id=g.id)
        g.slug = slug
    for k, v in changed.items():
        setattr(g, k, v)
    code, _ = _group_label(model)
    audit(db, user, f"{code}.updated", entity=g, reason=reason,
          old={k: old[k] for k in changed}, new=changed, request=request)
    if "active" in changed:
        audit(db, user, f"{code}.availability_changed", entity=g, reason=reason,
              old={"active": old["active"]}, new={"active": changed["active"]}, request=request)
    db.commit()
    return g


# --- services -------------------------------------------------------------------


def service_out(s: Service) -> ServiceOut:
    return ServiceOut.model_validate(s)


def get_service(db: Session, service_id: int) -> Service:
    s = db.get(Service, service_id)
    if s is None:
        raise NotFoundError("service_not_found", "El producto o servicio no existe.")
    return s


def _apply_filters(
    stmt: Select[Any],
    category_id: int | None,
    area_id: int | None,
    active: bool | None,
    billing: bool,
) -> Select[Any]:
    if category_id is not None:
        stmt = stmt.where(Service.category_id == category_id)
    if area_id is not None:
        stmt = stmt.where(Service.area_id == area_id)
    if active is not None:
        stmt = stmt.where(Service.active.is_(active))
    if billing:
        stmt = stmt.join(Category, Category.id == Service.category_id).where(
            Service.active.is_(True),
            Service.visible_in_billing.is_(True),
            Service.is_billable.is_(True),
            Category.active.is_(True),
        )
    return stmt


def _search_rank(term: str, name: str, aliases: str) -> int | None:
    """Lower is better; ``None`` when there is no match."""
    key_name = search_key(name)
    if key_name.startswith(term):
        return 0
    if any(w.startswith(term) for w in key_name.split(" ")):
        return 1
    if term in key_name:
        return 2
    alias_keys = [search_key(a) for a in aliases.replace(";", ",").split(",") if a.strip()]
    if any(a.startswith(term) for a in alias_keys):
        return 3
    if any(term in a for a in alias_keys):
        return 4
    return None


def list_services(
    db: Session,
    params: PageQuery,
    *,
    search: str | None = None,
    category_id: int | None = None,
    area_id: int | None = None,
    active: bool | None = None,
    billing: bool = False,
) -> dict[str, Any]:
    term = search_key(search or "")
    if not term:
        stmt = _apply_filters(select(Service), category_id, area_id, active, billing)
        stmt = stmt.order_by(Service.name, Service.id)
        total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
        rows = db.scalars(stmt.limit(params.per_page).offset(params.offset)).unique().all()
        items = [service_out(r) for r in rows]
        return {"items": items, "page": params.page, "per_page": params.per_page, "total": total}

    candidates = db.execute(
        _apply_filters(
            select(Service.id, Service.name, Service.aliases), category_id, area_id, active,
            billing,
        )
    ).all()
    ranked: list[tuple[int, str, int]] = []
    for sid, name, aliases in candidates:
        rank = _search_rank(term, name, aliases or "")
        if rank is None and term.isdigit() and int(term) == sid:
            rank = 0
        if rank is not None:
            ranked.append((rank, search_key(name), sid))
    ranked.sort()
    page_ids = [sid for _, _, sid in ranked[params.offset: params.offset + params.per_page]]
    by_id = {s.id: s for s in db.scalars(select(Service).where(Service.id.in_(page_ids)))}
    items = [service_out(by_id[i]) for i in page_ids if i in by_id]
    return {"items": items, "page": params.page, "per_page": params.per_page,
            "total": len(ranked)}


def _check_tax_rate(db: Session, rate_id: int | None) -> TaxRate | None:
    if rate_id is None:
        return None
    rate = db.get(TaxRate, rate_id)
    if rate is None or not rate.active:
        raise ValidationFailedError(fields={"tax_rate_id": "La tasa de impuesto no es válida."})
    return rate


def _check_category(db: Session, category_id: int) -> Category:
    cat = db.get(Category, category_id)
    if cat is None:
        raise ValidationFailedError(fields={"category_id": "La categoría no existe."})
    return cat


def _check_area(db: Session, area_id: int | None) -> Area | None:
    if area_id is None:
        return None
    area = db.get(Area, area_id)
    if area is None:
        raise ValidationFailedError(fields={"area_id": "El área no existe."})
    return area


def _ensure_service_slug_free(
    db: Session, category_id: int, slug: str, exclude_id: int | None = None
) -> None:
    other = db.scalar(
        select(Service).where(Service.category_id == category_id, Service.slug == slug)
    )
    if other is not None and other.id != exclude_id:
        raise ConflictError(
            "service_duplicate", "Ya existe un producto o servicio con ese nombre en la categoría."
        )


def _service_values(s: Service) -> dict[str, Any]:
    return {
        "name": s.name, "category_id": s.category_id, "area_id": s.area_id,
        "price_cents": s.price_cents, "tax_rate_id": s.tax_rate_id, "active": s.active,
        "visible_in_billing": s.visible_in_billing, "is_billable": s.is_billable,
        "description": s.description, "aliases": s.aliases,
    }


def create_service(
    db: Session, user: User, data: ServiceIn, request: Request | None
) -> Service:
    _check_category(db, data.category_id)
    _check_area(db, data.area_id)
    if "tax_rate_id" in data.model_fields_set:
        rate = _check_tax_rate(db, data.tax_rate_id)
    else:
        rate = default_tax_rate(db)
    name = collapse_spaces(data.name)
    slug = slugify(name, max_length=180)
    _ensure_service_slug_free(db, data.category_id, slug)
    s = Service(
        category_id=data.category_id, area_id=data.area_id, name=name, slug=slug,
        price_cents=data.price_cents, tax_rate_id=rate.id if rate else None,
        active=data.active, visible_in_billing=data.visible_in_billing,
        is_billable=data.is_billable, description=data.description, aliases=data.aliases,
    )
    db.add(s)
    db.flush()
    audit(db, user, "service.created", entity=s, new=_service_values(s), request=request)
    db.commit()
    db.refresh(s)
    return s


PRICE_FIELDS = {"price_cents"}
TAX_FIELDS = {"tax_rate_id"}
AVAILABILITY_FIELDS = {"active", "visible_in_billing", "is_billable"}
NULLABLE_FIELDS = {"area_id", "tax_rate_id"}


def _record_service_changes(
    db: Session, user: User, s: Service, old: dict[str, Any], changed: dict[str, Any],
    reason: str | None, request: Request | None,
) -> None:
    """Apply ``changed`` to ``s`` and write history/audit rows (no commit)."""
    for k, v in changed.items():
        setattr(s, k, v)
    if "price_cents" in changed:
        db.add(ServicePriceHistory(
            service_id=s.id, old_price_cents=old["price_cents"],
            new_price_cents=changed["price_cents"], reason=reason or "", changed_by=user.id,
        ))
        audit(db, user, "service.price_changed", entity=s, reason=reason,
              old={"price_cents": old["price_cents"]},
              new={"price_cents": changed["price_cents"]}, request=request)
    if "tax_rate_id" in changed:
        audit(db, user, "service.tax_changed", entity=s, reason=reason,
              old={"tax_rate_id": old["tax_rate_id"]},
              new={"tax_rate_id": changed["tax_rate_id"]}, request=request)
    avail = {k: v for k, v in changed.items() if k in AVAILABILITY_FIELDS}
    if avail:
        audit(db, user, "service.availability_changed", entity=s, reason=reason,
              old={k: old[k] for k in avail}, new=avail, request=request)
    other = {k: v for k, v in changed.items()
             if k not in PRICE_FIELDS | TAX_FIELDS | AVAILABILITY_FIELDS}
    if other:
        audit(db, user, "service.updated", entity=s, reason=reason,
              old={k: old[k] for k in other}, new=other, request=request)


def update_service(
    db: Session, user: User, service_id: int, data: ServicePatch, request: Request | None
) -> Service:
    s = get_service(db, service_id)
    values = {
        k: v for k, v in data.model_dump(exclude_unset=True, exclude={"reason"}).items()
        if v is not None or k in NULLABLE_FIELDS
    }
    if "name" in values:
        values["name"] = collapse_spaces(values["name"])
    old = _service_values(s)
    changed = {k: v for k, v in values.items() if old[k] != v}
    if not changed:
        return s
    sensitive = changed.keys() & (PRICE_FIELDS | TAX_FIELDS | AVAILABILITY_FIELDS)
    reason = require_reason(data.reason) if sensitive else (data.reason or None)
    if "category_id" in changed:
        _check_category(db, changed["category_id"])
    if "area_id" in changed:
        _check_area(db, changed["area_id"])
    if "tax_rate_id" in changed:
        _check_tax_rate(db, changed["tax_rate_id"])
    if "name" in changed or "category_id" in changed:
        slug = slugify(changed.get("name", s.name), max_length=180)
        _ensure_service_slug_free(db, changed.get("category_id", s.category_id), slug, s.id)
        s.slug = slug
    _record_service_changes(db, user, s, old, changed, reason, request)
    db.commit()
    db.refresh(s)
    return s


def price_history(db: Session, service_id: int, params: PageQuery) -> dict[str, Any]:
    get_service(db, service_id)
    base = select(ServicePriceHistory).where(ServicePriceHistory.service_id == service_id)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.scalars(
        base.order_by(ServicePriceHistory.changed_at.desc(), ServicePriceHistory.id.desc())
        .limit(params.per_page).offset(params.offset)
    ).all()
    user_ids = {r.changed_by for r in rows if r.changed_by}
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(user_ids)))}
    items = [
        PriceHistoryOut(
            id=r.id, old_price_cents=r.old_price_cents, new_price_cents=r.new_price_cents,
            reason=r.reason,
            changed_by=(Ref(id=users[r.changed_by].id, name=users[r.changed_by].name)
                        if r.changed_by in users else None),
            changed_at=r.changed_at,
        )
        for r in rows
    ]
    return {"items": items, "page": params.page, "per_page": params.per_page, "total": total}


def bulk_tax(
    db: Session, user: User, data: BulkTaxIn, request: Request | None
) -> list[int]:
    reason = require_reason(data.reason)
    _check_tax_rate(db, data.tax_rate_id)
    stmt = select(Service)
    if data.category_id is not None:
        _check_category(db, data.category_id)
        stmt = stmt.where(Service.category_id == data.category_id)
    else:
        ids = set(data.service_ids or [])
        stmt = stmt.where(Service.id.in_(ids))
        found = set(db.scalars(select(Service.id).where(Service.id.in_(ids))))
        missing = sorted(ids - found)
        if missing:
            raise ValidationFailedError(
                fields={"service_ids": f"No existen: {', '.join(map(str, missing[:20]))}."}
            )
    updated: list[int] = []
    for s in db.scalars(stmt.order_by(Service.id)):
        if s.tax_rate_id == data.tax_rate_id:
            continue
        old = _service_values(s)
        _record_service_changes(db, user, s, old, {"tax_rate_id": data.tax_rate_id}, reason,
                                request)
        updated.append(s.id)
    audit(db, user, "service.bulk_tax_changed", reason=reason,
          new={"tax_rate_id": data.tax_rate_id, "category_id": data.category_id,
               "service_ids": updated}, request=request)
    db.commit()
    return updated


# --- export ----------------------------------------------------------------------

EXPORT_COLUMNS = [
    "categoria", "servicio", "precio_lps", "area", "tasa", "activo", "visible_en_cobro",
    "facturable", "descripcion", "aliases",
]
EXEMPT_LABEL = "Exento"
_FORMULA_CHARS = ("=", "+", "-", "@", "\t", "\r")


def _yes_no(value: bool) -> str:
    return "si" if value else "no"


def _price_lps(cents: int) -> str:
    return f"{cents // 100}.{cents % 100:02d}"


def _export_services(db: Session, category_id: int | None) -> list[Service]:
    stmt = select(Service).join(Category, Category.id == Service.category_id)
    if category_id is not None:
        stmt = stmt.where(Service.category_id == category_id)
    return list(db.scalars(stmt.order_by(Category.sort_order, Category.name, Service.name)))


def _export_row(s: Service) -> list[Any]:
    return [
        s.category.name, s.name, _price_lps(s.price_cents), s.area.name if s.area else "",
        s.tax_rate.name if s.tax_rate else EXEMPT_LABEL, _yes_no(s.active),
        _yes_no(s.visible_in_billing), _yes_no(s.is_billable), s.description, s.aliases,
    ]


def _csv_safe(value: Any) -> Any:
    """Neutralize spreadsheet formulas (CSV injection) in text cells."""
    if isinstance(value, str) and value.startswith(_FORMULA_CHARS):
        return "'" + value
    return value


def export_csv(db: Session, category_id: int | None = None) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\r\n")
    writer.writerow(EXPORT_COLUMNS)
    for s in _export_services(db, category_id):
        writer.writerow([_csv_safe(v) for v in _export_row(s)])
    return ("﻿" + buf.getvalue()).encode("utf-8")


def export_xlsx(db: Session, category_id: int | None = None) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font

    wb = Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "Catálogo"
    ws.append(EXPORT_COLUMNS)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for s in _export_services(db, category_id):
        row = _export_row(s)
        row[2] = Decimal(s.price_cents) / 100
        ws.append(row)
        r = ws.max_row
        ws.cell(row=r, column=3).number_format = "0.00"
        for col in range(1, len(EXPORT_COLUMNS) + 1):
            cell = ws.cell(row=r, column=col)
            if isinstance(cell.value, str) and cell.value.startswith("="):
                cell.data_type = "s"  # never evaluate catalog text as a formula
    widths = [22, 40, 12, 18, 14, 8, 16, 11, 30, 30]
    for idx, width in enumerate(widths, start=1):
        ws.column_dimensions[chr(64 + idx)].width = width
    ws.freeze_panes = "A2"
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def export_filename(ext: str) -> str:
    return f"catalogo_servicios_{hn_today().isoformat()}.{ext}"


# --- import ----------------------------------------------------------------------

IMPORT_MAX_BYTES = 2 * 1024 * 1024
IMPORT_MAX_ROWS = 5000
REQUIRED_COLUMNS = ("categoria", "servicio", "precio_lps")
_TRUE = {"si", "s", "yes", "y", "true", "1", "x", "verdadero"}
_FALSE = {"no", "n", "false", "0", "falso"}
BOOL_COLUMNS = {"activo": "active", "visible_en_cobro": "visible_in_billing",
                "facturable": "is_billable"}


def _decode(content: bytes) -> str:
    for enc in ("utf-8-sig", "cp1252"):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    raise ValidationFailedError(fields={"file": "No se pudo leer el archivo (use UTF-8)."})


def _cell(row: dict[str, str], col: str) -> str:
    value = (row.get(col) or "").strip()
    if len(value) > 1 and value[0] == "'" and value[1] in _FORMULA_CHARS:
        value = value[1:]
    return value


def _parse_bool(value: str) -> bool | None:
    key = search_key(value)
    if key in _TRUE:
        return True
    if key in _FALSE:
        return False
    raise ValueError


@dataclass
class _Lookups:
    categories: dict[str, Category]
    areas: dict[str, Area]
    rates: list[TaxRate]
    default_rate: TaxRate | None
    services: dict[int, list[Service]]  # by category id
    new_categories: dict[str, str] = field(default_factory=dict)  # slug -> name


def _parse_tax(value: str, lk: _Lookups) -> tuple[bool, int | None]:
    """Return ``(keep, tax_rate_id)``. Raises ValueError when unknown."""
    key = search_key(value)
    if not key:
        return True, None
    if key in ("exento", "exenta", "no", "0", "0%", "0 %"):
        return False, None
    if key in ("si", "isv", "gravado"):
        if lk.default_rate is None:
            raise ValueError
        return False, lk.default_rate.id
    for rate in lk.rates:
        if search_key(rate.name) == key:
            return False, rate.id
    pct = key.replace("%", "").replace(" ", "").replace(",", ".")
    try:
        bp = int(Decimal(pct) * 100)
    except (ArithmeticError, ValueError):
        raise ValueError from None
    matches = sorted((r for r in lk.rates if r.rate_bp == bp), key=lambda r: not r.is_default)
    if not matches:
        raise ValueError
    return False, matches[0].id


def _load_lookups(db: Session) -> _Lookups:
    services: dict[int, list[Service]] = {}
    for s in db.scalars(select(Service)):
        services.setdefault(s.category_id, []).append(s)
    rates = list(db.scalars(select(TaxRate).where(TaxRate.active.is_(True))))
    return _Lookups(
        categories={c.slug: c for c in db.scalars(select(Category))},
        areas={a.slug: a for a in db.scalars(select(Area))},
        rates=rates,
        default_rate=next((r for r in rates if r.is_default), None),
        services=services,
    )


def _find_service(lk: _Lookups, category: Category | None, name: str) -> Service | None:
    if category is None:
        return None
    key, slug = search_key(name), slugify(name, max_length=180)
    pool = lk.services.get(category.id, [])
    return next((s for s in pool if search_key(s.name) == key), None) or next(
        (s for s in pool if s.slug == slug), None
    )


@dataclass
class _Planned:
    line: ImportLine
    values: dict[str, Any]
    category_slug: str
    service: Service | None


def _plan_row(lk: _Lookups, line_no: int, row: dict[str, str]) -> _Planned:
    cat_name = collapse_spaces(_cell(row, "categoria"))
    name = collapse_spaces(_cell(row, "servicio"))
    line = ImportLine(line=line_no, category=cat_name, name=name, action="error")
    errors: list[str] = []
    values: dict[str, Any] = {}

    if not cat_name:
        errors.append("La categoría es obligatoria.")
    elif len(cat_name) > 120:
        errors.append("La categoría admite como máximo 120 caracteres.")
    if not name:
        errors.append("El nombre del producto o servicio es obligatorio.")
    elif len(name) > 160:
        errors.append("El nombre admite como máximo 160 caracteres.")
    cat_slug = slugify(cat_name) if cat_name else ""
    category = lk.categories.get(cat_slug)
    if cat_name and category is None:
        line.new_category = True

    service = _find_service(lk, category, name) if name else None

    price_raw = _cell(row, "precio_lps")
    if not price_raw:
        errors.append("El precio es obligatorio.")
    else:
        try:
            values["price_cents"] = parse_money(price_raw)
        except ValueError as exc:
            errors.append(f"Precio inválido: {exc}")

    area_raw = _cell(row, "area")
    if area_raw:
        area = lk.areas.get(slugify(area_raw))
        if area is None:
            errors.append(f"El área «{area_raw}» no existe.")
        else:
            values["area_id"] = area.id

    tax_raw = _cell(row, "tasa")
    try:
        keep, rate_id = _parse_tax(tax_raw, lk)
        if not keep:
            values["tax_rate_id"] = rate_id
        elif service is None:
            values["tax_rate_id"] = lk.default_rate.id if lk.default_rate else None
    except ValueError:
        errors.append(f"La tasa «{tax_raw}» no existe o no está activa.")

    for col, attr in BOOL_COLUMNS.items():
        raw = _cell(row, col)
        if not raw:
            continue
        try:
            values[attr] = _parse_bool(raw)
        except ValueError:
            errors.append(f"Valor inválido en «{col}» (use si/no).")

    for col, attr, limit in (("descripcion", "description", 255), ("aliases", "aliases", 2000)):
        raw = _cell(row, col)
        if not raw:
            continue
        if len(raw) > limit:
            errors.append(f"«{col}» admite como máximo {limit} caracteres.")
        else:
            values[attr] = raw

    if errors:
        line.errors = errors
        return _Planned(line, values, cat_slug, service)

    if service is None:
        line.action = "create"
        values["name"] = name
        line.changes = {k: {"old": None, "new": v} for k, v in values.items()}
    else:
        line.service_id = service.id
        old = _service_values(service)
        changes = {k: {"old": old[k], "new": v} for k, v in values.items() if old[k] != v}
        line.changes = changes
        line.action = "update" if changes else "unchanged"
    return _Planned(line, values, cat_slug, service)


def _read_rows(content: bytes) -> list[dict[str, str]]:
    if len(content) > IMPORT_MAX_BYTES:
        raise ValidationFailedError(fields={"file": "El archivo debe pesar como máximo 2 MB."})
    text = _decode(content)
    if not text.strip():
        raise ValidationFailedError(fields={"file": "El archivo está vacío."})
    first_line = text.splitlines()[0]
    delimiter = ";" if first_line.count(";") > first_line.count(",") else ","
    reader = csv.DictReader(io.StringIO(text, newline=""), delimiter=delimiter)
    header = [search_key(h).replace(" ", "_") for h in (reader.fieldnames or [])]
    missing = [c for c in REQUIRED_COLUMNS if c not in header]
    if missing:
        raise ValidationFailedError(
            fields={"file": f"Faltan columnas obligatorias: {', '.join(missing)}."}
        )
    reader.fieldnames = header
    rows = []
    for row in reader:
        if not any((v or "").strip() for k, v in row.items() if k is not None and
                   isinstance(v, str)):
            rows.append({})  # blank line keeps numbering; skipped later
            continue
        rows.append({k: v for k, v in row.items() if k is not None and isinstance(v, str)})
        if len(rows) > IMPORT_MAX_ROWS:
            raise ValidationFailedError(
                fields={"file": f"El archivo admite como máximo {IMPORT_MAX_ROWS} filas."}
            )
    return rows


def import_services(
    db: Session, user: User, content: bytes, mode: str, reason: str | None,
    request: Request | None,
) -> ImportReport:
    rows = _read_rows(content)
    lk = _load_lookups(db)
    planned: list[_Planned] = []
    seen: dict[tuple[str, str], int] = {}
    for idx, row in enumerate(rows, start=2):  # line 1 is the header
        if not row:
            continue
        p = _plan_row(lk, idx, row)
        if p.line.name and p.category_slug:
            dup_key = (p.category_slug, search_key(p.line.name))
            if dup_key in seen:
                p.line.action = "error"
                p.line.errors.append(f"Fila repetida (ver línea {seen[dup_key]}).")
            else:
                seen[dup_key] = idx
        if p.line.new_category and p.line.action != "error":
            lk.new_categories.setdefault(p.category_slug, p.line.category)
        planned.append(p)

    lines = [p.line for p in planned]
    counts = {a: sum(1 for ln in lines if ln.action == a)
              for a in ("create", "update", "unchanged", "error")}
    summary = ImportSummary(total=len(lines), **counts,
                            new_categories=sorted(lk.new_categories.values()))
    report = ImportReport(mode=mode, applied=False, summary=summary, lines=lines)
    if mode != "apply":
        return report

    if not lines:
        raise ValidationFailedError(fields={"file": "El archivo no tiene filas para importar."})
    if counts["error"]:
        raise ValidationFailedError(
            "import_has_errors",
            "El archivo tiene errores. Corríjalos y vuelva a intentarlo; no se aplicó ningún "
            "cambio.",
            fields={f"linea_{ln.line}": " ".join(ln.errors) for ln in lines if ln.errors},
        )
    reason = require_reason(reason)
    try:
        _apply_import(db, user, lk, planned, reason, request)
        audit(db, user, "catalog.imported", reason=reason,
              new={"create": counts["create"], "update": counts["update"],
                   "unchanged": counts["unchanged"],
                   "new_categories": summary.new_categories}, request=request)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise BusinessRuleError(
            "import_conflict", "No se pudo aplicar la importación por un conflicto de datos."
        ) from exc
    report.applied = True
    return report


def _apply_import(
    db: Session, user: User, lk: _Lookups, planned: list[_Planned], reason: str,
    request: Request | None,
) -> None:
    max_order = db.scalar(select(func.max(Category.sort_order))) or 0
    for slug, name in lk.new_categories.items():
        max_order += 1
        cat = Category(name=name, slug=slug, active=True, sort_order=max_order)
        db.add(cat)
        db.flush()
        lk.categories[slug] = cat
        audit(db, user, "category.created", entity=cat, reason=reason,
              new={"name": name, "source": "import"}, request=request)
    for p in planned:
        if p.line.action == "create":
            cat = lk.categories[p.category_slug]
            v = p.values
            s = Service(
                category_id=cat.id, name=v["name"], slug=slugify(v["name"], max_length=180),
                area_id=v.get("area_id"), price_cents=v["price_cents"],
                tax_rate_id=v.get("tax_rate_id"), active=v.get("active", True),
                visible_in_billing=v.get("visible_in_billing", True),
                is_billable=v.get("is_billable", True), description=v.get("description", ""),
                aliases=v.get("aliases", ""),
            )
            db.add(s)
            db.flush()
            p.line.service_id = s.id
            audit(db, user, "service.created", entity=s, reason=reason,
                  new={**_service_values(s), "source": "import"}, request=request)
        elif p.line.action == "update" and p.service is not None:
            s = p.service
            old = _service_values(s)
            changed = {k: c["new"] for k, c in p.line.changes.items()}
            _record_service_changes(db, user, s, old, changed, reason, request)
    db.flush()
