"""Catalog: categories, areas, services CRUD, search, history, bulk tax."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ERYTHROPOIETIN_RULE, Category, ServicePriceHistory, User
from tests.factories import get_service, isv_rate, make_service
from tests.factories_admin import (
    REASON,
    audits,
    error_code,
    make_area,
    make_category,
    reload_service,
    tax_rate_named,
)

# --- categories / areas -------------------------------------------------------------


def test_list_categories_with_counts(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    resp = client.get("/api/categories")
    assert resp.status_code == 200
    body = resp.json()
    names = {c["name"]: c for c in body["items"]}
    assert "Laboratorio" in names
    assert names["Laboratorio"]["services_count"] == 89
    assert body["total"] == len(body["items"])


def test_cajero_cannot_create_category(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    assert client.post("/api/categories", json={"name": "Nueva"}).status_code == 403


def test_auditor_read_only_catalog(client: TestClient, db: Session,
                                   login_as: Callable[..., User]) -> None:
    login_as("auditor")
    assert client.get("/api/services").status_code == 200
    svc = get_service(db, "Tórax")
    assert client.patch(f"/api/services/{svc.id}", json={"name": "X"}).status_code == 403
    assert client.post("/api/areas", json={"name": "Nueva"}).status_code == 403


def test_create_category_and_duplicate(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("supervisor")
    resp = client.post("/api/categories", json={"name": "  Fisioterapia  ", "sort_order": 9})
    assert resp.status_code == 201, resp.text
    assert resp.json()["name"] == "Fisioterapia"
    assert resp.json()["slug"] == "fisioterapia"
    assert resp.json()["services_count"] == 0
    assert len(audits(db, "category.created")) == 1
    dup = client.post("/api/categories", json={"name": "fisioterapía"})
    assert dup.status_code == 409


def test_category_deactivation_requires_reason(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    cat = make_category(db)
    login_as("admin")
    resp = client.patch(f"/api/categories/{cat.id}", json={"active": False})
    assert resp.status_code == 422
    resp = client.patch(f"/api/categories/{cat.id}", json={"active": False, "reason": REASON})
    assert resp.status_code == 200
    assert resp.json()["active"] is False
    rows = audits(db, "category.availability_changed")
    assert len(rows) == 1 and rows[0].reason == REASON


def test_category_rename_without_reason(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    cat = make_category(db)
    login_as("admin")
    resp = client.patch(f"/api/categories/{cat.id}", json={"name": "Renombrada"})
    assert resp.status_code == 200
    assert resp.json()["slug"] == "renombrada"


def test_category_filter_active(client: TestClient, db: Session,
                                login_as: Callable[..., User]) -> None:
    make_category(db, "Inactiva X", active=False)
    login_as("admin")
    names = [c["name"] for c in client.get("/api/categories?active=false").json()["items"]]
    assert names == ["Inactiva X"]


def test_areas_crud(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    login_as("admin")
    resp = client.post("/api/areas", json={"name": "Fisiatría"})
    assert resp.status_code == 201
    area_id = resp.json()["id"]
    resp = client.patch(f"/api/areas/{area_id}", json={"sort_order": 3})
    assert resp.status_code == 200 and resp.json()["sort_order"] == 3
    assert client.patch("/api/areas/99999", json={"sort_order": 3}).status_code == 404
    listed = client.get("/api/areas").json()["items"]
    assert any(a["name"] == "Fisiatría" for a in listed)
    assert len(audits(db, "area.updated")) == 1


# --- services listing/search -------------------------------------------------------


def test_service_shape(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    svc = get_service(db, "Tórax")
    resp = client.get(f"/api/services/{svc.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["category"] == {"id": svc.category_id, "name": "Radiología"}
    assert body["area"]["name"] == "Rayos X"
    assert body["price_cents"] == 4500
    assert body["tax_rate"]["rate_bp"] == 1500
    assert set(body) >= {"id", "name", "category", "area", "price_cents", "tax_rate", "active",
                         "visible_in_billing", "is_billable", "special_rule_code", "aliases",
                         "description"}


def test_service_404(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    assert client.get("/api/services/999999").status_code == 404


def test_list_paginated(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    body = client.get("/api/services?per_page=10&page=2").json()
    assert body["page"] == 2 and body["per_page"] == 10
    assert len(body["items"]) == 10
    assert body["total"] == 151


def test_search_accent_insensitive(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    names = [s["name"] for s in client.get("/api/services?search=TORAX").json()["items"]]
    assert "Tórax" in names
    assert names[0] == "Tórax"  # prefix match ranks first


def test_search_by_alias(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    names = [s["name"] for s in client.get("/api/services?search=operacion").json()["items"]]
    assert names == ["Cirugía"]


def test_search_pagination_total(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    body = client.get("/api/services?search=eritro&per_page=1").json()
    assert body["total"] == 2
    assert len(body["items"]) == 1


def test_billing_filter(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    make_service(db, name="Oculto en caja", visible_in_billing=False)
    make_service(db, name="Oculto inactivo", active=False)
    off_cat = make_category(db, "Categoría apagada", active=False)
    make_service(db, name="Oculto categoria", category=off_cat)
    login_as("cajero")
    everything = client.get("/api/services?search=oculto").json()
    assert everything["total"] == 3
    assert client.get("/api/services?search=oculto&billing=1").json()["total"] == 0
    assert client.get("/api/services?search=k.d.h&billing=1").json()["total"] == 0
    assert client.get("/api/services?search=k.d.h").json()["total"] == 2


def test_filter_by_category_and_active(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    cat = db.scalar(select(Category).where(Category.name == "Medicamentos"))
    assert cat is not None
    login_as("cajero")
    body = client.get(f"/api/services?category_id={cat.id}").json()
    assert [s["name"] for s in body["items"]] == ["Eritropoyetina"]
    inactive = client.get("/api/services?active=0").json()
    assert inactive["total"] >= 2
    assert all(s["active"] is False for s in inactive["items"])


# --- services create/update -------------------------------------------------------


def _new_service(db: Session, **over: Any) -> dict[str, Any]:
    cat = db.scalar(select(Category).where(Category.name == "Laboratorio"))
    assert cat is not None
    data: dict[str, Any] = {"name": "Prueba de dengue", "category_id": cat.id,
                            "price_cents": 35000}
    data.update(over)
    return data


def test_create_service_defaults_to_default_tax(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("supervisor")
    resp = client.post("/api/services", json=_new_service(db))
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["tax_rate"]["id"] == isv_rate(db).id
    assert body["active"] and body["visible_in_billing"] and body["is_billable"]
    assert body["special_rule_code"] is None
    assert len(audits(db, "service.created")) == 1


def test_create_service_exempt_with_null(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    resp = client.post("/api/services", json=_new_service(db, tax_rate_id=None))
    assert resp.status_code == 201
    assert resp.json()["tax_rate"] is None


def test_create_service_validations(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    assert client.post("/api/services", json=_new_service(db, price_cents=-1)).status_code == 422
    assert client.post("/api/services", json=_new_service(db, category_id=9999)
                       ).status_code == 422
    assert client.post("/api/services", json=_new_service(db, area_id=9999)).status_code == 422
    assert client.post("/api/services", json=_new_service(db, tax_rate_id=9999)
                       ).status_code == 422
    assert client.post("/api/services", json=_new_service(db, name="")).status_code == 422


def test_create_duplicate_in_category(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    resp = client.post("/api/services", json=_new_service(db, name="ACIDO URICO"))
    assert resp.status_code == 409
    assert error_code(resp) == "service_duplicate"


def test_special_rule_code_cannot_be_set(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    resp = client.post("/api/services",
                       json=_new_service(db, special_rule_code=ERYTHROPOIETIN_RULE))
    assert resp.status_code == 422
    epo = get_service(db, "Eritropoyetina")
    resp = client.patch(f"/api/services/{epo.id}", json={"special_rule_code": None})
    assert resp.status_code == 422
    assert reload_service(db, epo.id).special_rule_code == ERYTHROPOIETIN_RULE


def test_epo_price_change_keeps_rule(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    epo = get_service(db, "Eritropoyetina")
    login_as("admin")
    resp = client.patch(f"/api/services/{epo.id}", json={"price_cents": 3000, "reason": REASON})
    assert resp.status_code == 200
    assert resp.json()["special_rule_code"] == ERYTHROPOIETIN_RULE


def test_price_change_requires_reason_and_writes_history(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    svc = get_service(db, "Tórax")
    admin = login_as("admin")
    resp = client.patch(f"/api/services/{svc.id}", json={"price_cents": 5000})
    assert resp.status_code == 422
    assert "reason" in resp.json()["error"]["fields"]
    resp = client.patch(f"/api/services/{svc.id}", json={"price_cents": 5000, "reason": REASON})
    assert resp.status_code == 200
    assert resp.json()["price_cents"] == 5000
    db.expire_all()
    hist = list(db.scalars(select(ServicePriceHistory)
                           .where(ServicePriceHistory.service_id == svc.id)))
    assert len(hist) == 1
    assert (hist[0].old_price_cents, hist[0].new_price_cents) == (4500, 5000)
    assert hist[0].changed_by == admin.id and hist[0].reason == REASON
    rows = audits(db, "service.price_changed")
    assert len(rows) == 1 and rows[0].entity_id == svc.id

    history = client.get(f"/api/services/{svc.id}/history").json()
    assert history["total"] == 1
    item = history["items"][0]
    assert item["old_price_cents"] == 4500 and item["new_price_cents"] == 5000
    assert item["changed_by"] == {"id": admin.id, "name": admin.name}
    assert item["changed_at"].endswith("-06:00")


def test_tax_change_requires_reason(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    svc = get_service(db, "Tórax")
    login_as("admin")
    assert client.patch(f"/api/services/{svc.id}", json={"tax_rate_id": None}).status_code == 422
    resp = client.patch(f"/api/services/{svc.id}", json={"tax_rate_id": None, "reason": REASON})
    assert resp.status_code == 200
    assert resp.json()["tax_rate"] is None
    assert len(audits(db, "service.tax_changed")) == 1


def test_availability_change_requires_reason(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    svc = get_service(db, "Tórax")
    login_as("admin")
    resp = client.patch(f"/api/services/{svc.id}", json={"visible_in_billing": False})
    assert resp.status_code == 422
    resp = client.patch(f"/api/services/{svc.id}",
                        json={"visible_in_billing": False, "active": False, "reason": REASON})
    assert resp.status_code == 200
    rows = audits(db, "service.availability_changed")
    assert len(rows) == 1
    assert rows[0].new_values == {"visible_in_billing": False, "active": False}


def test_non_sensitive_edit_without_reason(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    svc = get_service(db, "Tórax")
    area = make_area(db, "Imagenología")
    login_as("admin")
    resp = client.patch(f"/api/services/{svc.id}", json={
        "description": "Radiografía de tórax", "aliases": "RX torax, placa",
        "area_id": area.id})
    assert resp.status_code == 200, resp.text
    assert resp.json()["area"]["name"] == "Imagenología"
    assert len(audits(db, "service.updated")) == 1
    names = [s["name"] for s in client.get("/api/services?search=placa").json()["items"]]
    assert names == ["Tórax"]


def test_patch_without_changes_is_noop(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    svc = get_service(db, "Tórax")
    login_as("admin")
    resp = client.patch(f"/api/services/{svc.id}", json={"price_cents": 4500})
    assert resp.status_code == 200
    assert audits(db, "service.price_changed") == []


def test_rename_to_existing_name_conflicts(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    svc = get_service(db, "Tórax")
    other = make_service(db, name="Otro estudio", category=svc.category)
    login_as("admin")
    resp = client.patch(f"/api/services/{other.id}", json={"name": "TORAX"})
    assert resp.status_code == 409


def test_history_requires_catalog_view(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("soporte")
    svc = get_service(db, "Tórax")
    assert client.get(f"/api/services/{svc.id}/history").status_code == 403


# --- bulk tax --------------------------------------------------------------------


def test_bulk_tax_by_category(client: TestClient, db: Session,
                              login_as: Callable[..., User]) -> None:
    cat = db.scalar(select(Category).where(Category.name == "Odontología"))
    assert cat is not None
    exento = tax_rate_named(db, "Exento 0 %")
    login_as("admin")
    resp = client.patch("/api/services/bulk-tax", json={
        "category_id": cat.id, "tax_rate_id": exento.id, "reason": REASON})
    assert resp.status_code == 200, resp.text
    assert resp.json()["updated"] == 3
    assert len(audits(db, "service.tax_changed")) == 3
    assert len(audits(db, "service.bulk_tax_changed")) == 1
    again = client.patch("/api/services/bulk-tax", json={
        "category_id": cat.id, "tax_rate_id": exento.id, "reason": REASON})
    assert again.json()["updated"] == 0


def test_bulk_tax_by_ids_to_exempt(client: TestClient, db: Session,
                                   login_as: Callable[..., User]) -> None:
    a, b = make_service(db), make_service(db)
    login_as("admin")
    resp = client.patch("/api/services/bulk-tax", json={
        "service_ids": [a.id, b.id], "tax_rate_id": None, "reason": REASON})
    assert resp.status_code == 200
    assert sorted(resp.json()["service_ids"]) == sorted([a.id, b.id])
    assert reload_service(db, a.id).tax_rate_id is None


def test_bulk_tax_validation(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    both = client.patch("/api/services/bulk-tax", json={
        "category_id": 1, "service_ids": [1], "tax_rate_id": None, "reason": REASON})
    assert both.status_code == 422
    neither = client.patch("/api/services/bulk-tax", json={"tax_rate_id": None,
                                                           "reason": REASON})
    assert neither.status_code == 422
    no_reason = client.patch("/api/services/bulk-tax", json={"category_id": 1,
                                                             "tax_rate_id": None})
    assert no_reason.status_code == 422
    missing = client.patch("/api/services/bulk-tax", json={
        "service_ids": [999999], "tax_rate_id": None, "reason": REASON})
    assert missing.status_code == 422


def test_bulk_tax_forbidden_for_cajero(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    resp = client.patch("/api/services/bulk-tax", json={
        "category_id": 1, "tax_rate_id": None, "reason": REASON})
    assert resp.status_code == 403
