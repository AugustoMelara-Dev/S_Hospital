"""Catalog CSV/XLSX export and CSV import (preview/apply)."""

from __future__ import annotations

import csv
import io
from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient
from openpyxl import load_workbook
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ERYTHROPOIETIN_RULE, Category, Service, ServicePriceHistory, User
from tests.factories import get_service, make_service
from tests.factories_admin import REASON, audits, reload_service

HEADER = ("categoria,servicio,precio_lps,area,tasa,activo,visible_en_cobro,facturable,"
          "descripcion,aliases")


def _csv(*rows: str, header: str = HEADER) -> bytes:
    return ("\n".join([header, *rows]) + "\n").encode("utf-8")


def _import(client: TestClient, content: bytes, mode: str = "preview",
            reason: str | None = REASON) -> Any:
    data = {"reason": reason} if reason is not None else {}
    return client.post(f"/api/services/import?mode={mode}",
                       files={"file": ("catalogo.csv", content, "text/csv")}, data=data)


def _count_services(db: Session) -> int:
    return db.scalar(select(func.count(Service.id))) or 0


# --- export ----------------------------------------------------------------------


def test_export_csv_has_bom_and_parses(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("auditor")
    resp = client.get("/api/services/export.csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert "attachment" in resp.headers["content-disposition"]
    assert resp.content.startswith(b"\xef\xbb\xbf")
    rows = list(csv.DictReader(io.StringIO(resp.content.decode("utf-8-sig"))))
    assert len(rows) == 151
    torax = next(r for r in rows if r["servicio"] == "Tórax")
    assert torax["categoria"] == "Radiología"
    assert torax["precio_lps"] == "45.00"
    assert torax["tasa"] == "ISV 15 %"
    assert torax["area"] == "Rayos X"
    assert torax["activo"] == "si"


def test_export_csv_neutralizes_formulas(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    make_service(db, name="=HYPERLINK(\"x\")")
    login_as("admin")
    text = client.get("/api/services/export.csv").content.decode("utf-8-sig")
    assert "'=HYPERLINK" in text


def test_export_xlsx_parses(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("supervisor")
    resp = client.get("/api/services/export.xlsx")
    assert resp.status_code == 200
    wb = load_workbook(io.BytesIO(resp.content))
    ws = wb.active
    assert ws is not None
    rows = list(ws.iter_rows(values_only=True))
    assert rows[0][:3] == ("categoria", "servicio", "precio_lps")
    assert len(rows) == 152
    torax = next(r for r in rows if r[1] == "Tórax")
    assert float(torax[2]) == 45.0


def test_export_requires_catalog_view(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("soporte")
    assert client.get("/api/services/export.csv").status_code == 403
    assert client.get("/api/services/export.xlsx").status_code == 403


def test_export_then_import_is_unchanged(
    client: TestClient, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    content = client.get("/api/services/export.csv").content
    resp = _import(client, content)
    assert resp.status_code == 200, resp.text
    summary = resp.json()["summary"]
    assert summary["error"] == 0, [ln for ln in resp.json()["lines"] if ln["errors"]][:3]
    assert summary["create"] == 0 and summary["update"] == 0
    assert summary["unchanged"] == 151


# --- import ----------------------------------------------------------------------


def test_import_preview_does_not_write(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    before = _count_services(db)
    content = _csv(
        "Radiología,TORAX,50.00,,,,,,,",                          # update price
        "Laboratorio,Prueba nueva,120.50,Laboratorio,exento,si,si,si,Desc,alias uno",
        "Fisioterapia,Terapia física,300,,15,,,,,",                # new category
        "Laboratorio,,10,,,,,,,",                                  # error: no name
    )
    resp = _import(client, content)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["mode"] == "preview" and body["applied"] is False
    s = body["summary"]
    assert (s["create"], s["update"], s["unchanged"], s["error"]) == (2, 1, 0, 1)
    assert s["new_categories"] == ["Fisioterapia"]
    lines = {ln["line"]: ln for ln in body["lines"]}
    assert lines[2]["action"] == "update"
    assert lines[2]["changes"] == {"price_cents": {"old": 4500, "new": 5000}}
    assert lines[3]["action"] == "create"
    assert lines[4]["new_category"] is True
    assert lines[5]["action"] == "error" and lines[5]["errors"]
    assert _count_services(db) == before


def test_import_apply_rejects_when_errors(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    before = _count_services(db)
    resp = _import(client, _csv("Laboratorio,Nuevo A,10,,,,,,,",
                                "Laboratorio,Nuevo B,abc,,,,,,,"), mode="apply")
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "import_has_errors"
    assert "linea_3" in resp.json()["error"]["fields"]
    assert _count_services(db) == before


def test_import_apply_requires_reason(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    resp = _import(client, _csv("Laboratorio,Nuevo A,10,,,,,,,"), mode="apply", reason=None)
    assert resp.status_code == 422
    assert "reason" in resp.json()["error"]["fields"]


def test_import_apply_upserts(client: TestClient, db: Session,
                              login_as: Callable[..., User]) -> None:
    torax = get_service(db, "Tórax")
    epo = get_service(db, "Eritropoyetina")
    login_as("admin")
    content = _csv(
        "radiologia,torax,50.00,,exento,,,,,",
        "Medicamentos,Eritropoyetina,30.00,,,,,,,",
        "Laboratorio,Prueba nueva,120.50,Laboratorio,,no,,,Desc,alias uno",
        "Fisioterapia,Terapia física,300,,15,,,,,",
    )
    resp = _import(client, content, mode="apply")
    assert resp.status_code == 200, resp.text
    assert resp.json()["applied"] is True

    t = reload_service(db, torax.id)
    assert t.price_cents == 5000 and t.tax_rate_id is None
    e = reload_service(db, epo.id)
    assert e.price_cents == 3000
    assert e.special_rule_code == ERYTHROPOIETIN_RULE  # never touched by import

    new = db.scalar(select(Service).where(Service.name == "Prueba nueva"))
    assert new is not None
    assert new.price_cents == 12050 and new.active is False
    assert new.tax_rate is not None and new.tax_rate.rate_bp == 1500  # default when empty
    assert new.area is not None and new.area.name == "Laboratorio"
    assert new.aliases == "alias uno"

    cat = db.scalar(select(Category).where(Category.slug == "fisioterapia"))
    assert cat is not None
    fisio = db.scalar(select(Service).where(Service.category_id == cat.id))
    assert fisio is not None and fisio.tax_rate is not None and fisio.tax_rate.rate_bp == 1500

    hist = db.scalar(select(func.count(ServicePriceHistory.id))) or 0
    assert hist == 2
    assert len(audits(db, "catalog.imported")) == 1
    assert len(audits(db, "service.price_changed")) == 2
    assert len(audits(db, "service.tax_changed")) == 1
    assert len(audits(db, "service.created")) == 2
    assert all(a.reason == REASON for a in audits(db, "service.price_changed"))


def test_import_semicolon_delimiter_and_cp1252(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    text = "categoria;servicio;precio_lps\nLaboratorio;Prueba ñandú;1.234,00\n"
    resp = _import(client, text.encode("cp1252"))
    assert resp.status_code == 200
    line = resp.json()["lines"][0]
    # "1.234,00" is not a valid amount (decimal comma) -> per-line error
    assert line["action"] == "error"
    ok = _import(client, "categoria;servicio;precio_lps\nLaboratorio;Prueba ñandú;1234.00\n"
                 .encode("cp1252"), mode="apply")
    assert ok.status_code == 200, ok.text
    assert db.scalar(select(Service).where(Service.name == "Prueba ñandú")) is not None


def test_import_line_validations(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    content = _csv(
        "Laboratorio,X1,-5,,,,,,,",
        "Laboratorio,X2,10,Area inventada,,,,,,",
        "Laboratorio,X3,10,,18 %,,,,,",
        "Laboratorio,X4,10,,,talvez,,,,",
        "Laboratorio,X5,10.555,,,,,,,",
        "Laboratorio,X6,10,,,,,,,",
        "Laboratorio,x6,11,,,,,,,",
    )
    lines = _import(client, content).json()["lines"]
    assert [ln["action"] for ln in lines] == ["error"] * 5 + ["create", "error"]
    assert "repetida" in lines[6]["errors"][0]


def test_import_missing_columns(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    resp = _import(client, _csv("Lab,X", header="categoria,servicio"))
    assert resp.status_code == 422
    assert "precio_lps" in resp.json()["error"]["fields"]["file"]


def test_import_empty_file(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    assert _import(client, b"").status_code == 422


def test_import_forbidden_for_cajero(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    assert _import(client, _csv("Laboratorio,X,10,,,,,,,")).status_code == 403
