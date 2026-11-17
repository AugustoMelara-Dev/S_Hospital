"""Reports: totals, filters, own scope, Honduras day bounds, PDF and XLSX exports."""

from __future__ import annotations

import io
from datetime import UTC, datetime, timedelta
from typing import Any

from openpyxl import load_workbook
from pypdf import PdfReader
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.timeutil import hn_today
from app.models import AuditLog, Category
from tests.factories import make_service, make_user, open_cash_session
from tests.factories_reports import make_invoice, open_session_on_new_register

TODAY = hn_today().isoformat()


def scenario(db: Session) -> dict[str, Any]:
    """Two cashiers; cashier A: paid cash 115, partial card 100/230, free-by-rule (EPO),
    void; cashier B: paid transfer 300 (category X)."""
    a = make_user(db, "cajero", name="Ana Cajera")
    b = make_user(db, "cajero", name="Beto Cajero")
    sa, sb = open_cash_session(db, a, 10_000), open_session_on_new_register(db, b)
    cat = db.scalars(select(Category).order_by(Category.id.desc())).first()
    svc_x = make_service(db, name="Rayos X tórax", price_cents=30_000, taxable=False,
                         category=cat)
    paid = make_invoice(db, a, sa, [{"name": "Consulta", "price_cents": 10_000,
                                     "rate_bp": 1500}], payments=[("cash", 11_500)])
    partial = make_invoice(db, a, sa, [{"name": "Curación", "price_cents": 20_000,
                                        "rate_bp": 1500}], payments=[("card", 10_000)])
    free = make_invoice(db, a, sa, [{"name": "Eritropoyetina", "price_cents": 40_000,
                                     "qty": 200, "free": True}])
    void = make_invoice(db, a, sa, [{"name": "Laboratorio", "price_cents": 5_000}], void=True)
    other = make_invoice(db, b, sb, [{"service": svc_x, "price_cents": 30_000}],
                         payments=[("transfer", 30_000)])
    return {"a": a, "b": b, "sa": sa, "sb": sb, "cat": cat, "paid": paid,
            "partial": partial, "free": free, "void": void, "other": other}


def login(client: Any, user: Any) -> None:
    r = client.post("/api/auth/login", json={"login": user.username,
                                             "password": "Prueba#Segura2026"})
    assert r.status_code == 200, r.text


def test_summary_totals_all_scope(db: Session, client: Any, login_as: Any) -> None:
    sc = scenario(db)
    login_as("supervisor")
    r = client.get(f"/api/reports/summary?date_from={TODAY}&date_to={TODAY}")
    assert r.status_code == 200, r.text
    data = r.json()
    s = data["summary"]
    assert s["billed_cents"] == 11_500 + 23_000 + 0 + 30_000
    assert s["collected_cents"] == 11_500 + 10_000 + 30_000
    assert s["pending_cents"] == 13_000
    assert s["invoices_count"] == 4
    assert s["paid_count"] == 3 and s["partial_count"] == 1
    assert s["without_charge_count"] == 1
    assert s["voided_count"] == 1 and s["voided_cents"] == 5_000 and s["reversed_cents"] == 0
    assert s["free_lines_count"] == 1 and s["free_value_cents"] == 80_000
    assert s["average_ticket_cents"] == (64_500 * 2 + 4) // 8
    by_method = {m["method"]: m for m in data["by_method"]}
    assert by_method["cash"]["amount_cents"] == 11_500
    assert by_method["card"]["amount_cents"] == 10_000
    assert by_method["transfer"]["count"] == 1
    assert by_method["other"]["amount_cents"] == 0
    assert data["daily"] == [{"date": TODAY, "billed_cents": 64_500, "collected_cents": 51_500,
                              "invoices_count": 4}]
    assert len(data["operations"]) == 5
    assert {o["number"] for o in data["operations"] if o["receipt_number"]} == {
        sc["paid"].number, sc["free"].number, sc["other"].number}
    assert len(data["lines"]) == 4
    assert data["gratuities"][0]["value_cents"] == 80_000
    assert data["gratuities"][0]["patient_name"] == "Paciente de Prueba"
    assert data["top_services"][0]["service_name"] == "Rayos X tórax"
    assert {x["user_name"] for x in data["sessions"]} == {"Ana Cajera", "Beto Cajero"}
    sess_a = next(x for x in data["sessions"] if x["user_name"] == "Ana Cajera")
    assert sess_a["expected_cash_cents"] == 10_000 + 11_500
    assert len(data["payments"]) == 3


def test_summary_filters(db: Session, client: Any, login_as: Any) -> None:
    sc = scenario(db)
    login_as("supervisor")
    base = f"/api/reports/summary?date_from={TODAY}&date_to={TODAY}"

    s = client.get(f"{base}&user_id={sc['b'].id}").json()["summary"]
    assert s["billed_cents"] == 30_000 and s["collected_cents"] == 30_000

    data = client.get(f"{base}&method=card").json()
    assert data["summary"]["collected_cents"] == 10_000
    assert [o["number"] for o in data["operations"]] == [sc["partial"].number]

    data = client.get(f"{base}&status=without_charge").json()
    assert [o["number"] for o in data["operations"]] == [sc["free"].number]
    data = client.get(f"{base}&status=void").json()
    assert data["summary"]["voided_cents"] == 5_000 and data["summary"]["billed_cents"] == 0

    data = client.get(f"{base}&category_id={sc['cat'].id}").json()
    assert [o["number"] for o in data["operations"]] == [sc["other"].number]
    assert [line["service_name"] for line in data["lines"]] == ["Rayos X tórax"]

    data = client.get(f"{base}&cash_session_id={sc['sa'].id}").json()
    assert data["summary"]["collected_cents"] == 21_500
    assert [x["id"] for x in data["sessions"]] == [sc["sa"].id]

    assert client.get(f"{base}&method=bitcoin").status_code == 422
    assert client.get(f"{base}&status=raro").status_code == 422


def test_own_scope_is_forced(db: Session, client: Any) -> None:
    sc = scenario(db)
    login(client, sc["a"])
    data = client.get(f"/api/reports/summary?user_id={sc['b'].id}").json()
    assert data["filters"]["user_id"] == sc["a"].id
    assert data["summary"]["billed_cents"] == 11_500 + 23_000
    assert {o["cashier_name"] for o in data["operations"]} == {"Ana Cajera"}
    today = client.get("/api/reports/today").json()
    assert today["scope"] == "own"
    assert today["billed_cents"] == 34_500 and today["collected_cents"] == 21_500
    assert today["attention"]["pending_count"] == 1
    assert today["current_session"]["id"] == sc["sa"].id


def test_today_all_scope(db: Session, client: Any, login_as: Any) -> None:
    scenario(db)
    login_as("auditor")
    data = client.get("/api/reports/today").json()
    assert data["scope"] == "all"
    assert data["billed_cents"] == 64_500
    assert data["voided_count"] == 1 and data["without_charge_count"] == 1
    assert len(data["recent_operations"]) == 5
    assert data["attention"]["missing_receipts_count"] == 0
    assert data["current_session"] is None


def test_honduras_day_bounds(db: Session, client: Any, login_as: Any) -> None:
    user = make_user(db, "cajero")
    sess = open_cash_session(db, user)
    yesterday = hn_today() - timedelta(days=1)
    # 23:30 Honduras time yesterday == 05:30 UTC today
    late = datetime(yesterday.year, yesterday.month, yesterday.day, 23, 30,
                    tzinfo=UTC) + timedelta(hours=6)
    make_invoice(db, user, sess, [{"name": "Consulta nocturna", "price_cents": 7_000}],
                 payments=[("cash", 7_000)], issued_at=late)
    login_as("supervisor")
    y = yesterday.isoformat()
    assert client.get(f"/api/reports/summary?date_from={y}&date_to={y}").json()[
        "summary"]["billed_cents"] == 7_000
    assert client.get(f"/api/reports/summary?date_from={TODAY}&date_to={TODAY}").json()[
        "summary"]["billed_cents"] == 0


def test_period_validation(client: Any, login_as: Any) -> None:
    login_as("supervisor")
    r = client.get("/api/reports/summary?date_from=2026-01-01&date_to=2026-04-03")
    assert r.status_code == 422 and "date_to" in r.json()["error"]["fields"]
    assert client.get("/api/reports/summary?date_from=2026-01-01&date_to=2026-04-02"
                      ).status_code == 200
    assert client.get("/api/reports/summary?date_from=2026-05-02&date_to=2026-05-01"
                      ).status_code == 422
    assert client.get("/api/reports/summary?date_from=nope").status_code == 422


def test_report_permissions(client: Any, login_as: Any) -> None:
    login_as("soporte")
    assert client.get("/api/reports/today").status_code == 403
    assert client.get("/api/reports/summary").status_code == 403
    login_as("cajero")  # reports.own without reports.export
    assert client.get("/api/reports/summary").status_code == 200
    assert client.get("/api/reports/summary.pdf").status_code == 403
    assert client.get("/api/reports/summary.xlsx").status_code == 403
    login_as("auditor")  # reports.all without export
    assert client.get("/api/reports/summary.xlsx").status_code == 403


def test_summary_pdf(db: Session, client: Any, login_as: Any) -> None:
    scenario(db)
    login_as("supervisor")
    r = client.get(f"/api/reports/summary.pdf?date_from={TODAY}&date_to={TODAY}")
    assert r.status_code == 200, r.text
    assert r.content.startswith(b"%PDF")
    reader = PdfReader(io.BytesIO(r.content))
    assert reader.pages[0].mediabox.width > reader.pages[0].mediabox.height  # landscape
    text = "\n".join(p.extract_text() for p in reader.pages)
    for expected in ("Reporte de caja y facturación", "Facturado", "L 645.00", "Cobrado",
                     "L 515.00", "Gratuidades", "Eritropoyetina", "Rayos X tórax"):
        assert expected in text, expected
    assert db.scalar(select(func.count(AuditLog.id)).where(
        AuditLog.action == "report.exported")) == 1


def test_summary_xlsx(db: Session, client: Any, login_as: Any) -> None:
    scenario(db)
    login_as("supervisor")
    r = client.get(f"/api/reports/summary.xlsx?date_from={TODAY}&date_to={TODAY}")
    assert r.status_code == 200, r.text
    assert "attachment" in r.headers["content-disposition"]
    wb = load_workbook(io.BytesIO(r.content))
    assert wb.sheetnames == ["Resumen", "Por método", "Diario", "Operaciones", "Detalle",
                             "Cobros", "Caja", "Gratuidades", "Top servicios"]
    resumen = {row[0]: row[1] for row in wb["Resumen"].iter_rows(min_row=2, values_only=True)}
    assert float(resumen["Facturado"]) == 645.0
    assert float(resumen["Cobrado"]) == 515.0
    ops = wb["Operaciones"]
    assert ops.max_row == 6
    assert ops["E2"].number_format == '"L" #,##0.00'
    assert isinstance(ops["E2"].value, int | float)
